import { invoke } from "@tauri-apps/api/core";
import { getServerActiveNick, useMockStore } from "@/lib/mock-store";
import { serverSupportsMetadata } from "@/lib/avatar";

const lastAttempt = new Map<string, number>();
let queue: Array<{ serverId: string; nick: string }> = [];
let timer: ReturnType<typeof setTimeout> | null = null;

const CTCP_GAP_MS = 500;
const METADATA_GAP_MS = 150;
const RETRY_MS = 10 * 60 * 1000;

function key(serverId: string, nick: string) {
  return `${serverId}:${nick.toLowerCase()}`;
}

function gapMs(serverId: string) {
  return serverSupportsMetadata(useMockStore.getState().serverCaps[serverId])
    ? METADATA_GAP_MS
    : CTCP_GAP_MS;
}

function pump() {
  timer = null;
  const next = queue.shift();
  if (!next) return;
  invoke("request_nick_avatar", { serverId: next.serverId, nick: next.nick }).catch(() => {});
  if (queue.length > 0) {
    timer = setTimeout(pump, gapMs(next.serverId));
  }
}

function enqueue(serverId: string, nick: string) {
  const nickTrim = nick.trim();
  if (!nickTrim) return;
  const attemptKey = key(serverId, nickTrim);
  const now = Date.now();
  const previous = lastAttempt.get(attemptKey) || 0;
  if (now - previous < RETRY_MS) return;
  lastAttempt.set(attemptKey, now);
  if (queue.some((item) => item.serverId === serverId && item.nick.toLowerCase() === nickTrim.toLowerCase())) {
    return;
  }
  queue.push({ serverId, nick: nickTrim });
  if (!timer) {
    timer = setTimeout(pump, gapMs(serverId));
  }
}

export function noteAvatarReconnect(serverId: string) {
  for (const attemptKey of lastAttempt.keys()) {
    if (attemptKey.startsWith(`${serverId}:`)) {
      lastAttempt.delete(attemptKey);
    }
  }
}

export function discoverAvatars(
  serverId: string,
  nicks: string[],
  source: "names" | "join" | "revalidate" = "names"
) {
  const store = useMockStore.getState();
  const server = store.servers.find((item) => item.id === serverId);
  if (!server || !store.ircConnectedServers[serverId]) return;
  const hasMetadata = serverSupportsMetadata(store.serverCaps[serverId]);
  if ((source === "names" || source === "revalidate") && !hasMetadata) return;

  const selfNick = getServerActiveNick(server).toLowerCase();
  const delay = source === "join" ? 0 : hasMetadata ? 2000 : 400;

  window.setTimeout(() => {
    const latest = useMockStore.getState();
    const current = latest.servers.find((item) => item.id === serverId);
    if (!current) return;
    for (const nick of nicks) {
      if (!nick || nick.toLowerCase() === selfNick) continue;
      const member = current.members.find(
        (item) => item.profile.name.toLowerCase() === nick.toLowerCase()
      );
      if (source !== "revalidate" && member?.profile.imageUrl) continue;
      enqueue(serverId, nick);
    }
  }, delay);
}

export function requestAvatarIfMissing(serverId: string, nick: string) {
  const store = useMockStore.getState();
  const server = store.servers.find((item) => item.id === serverId);
  if (!server) return;
  const member = server.members.find(
    (item) => item.profile.name.toLowerCase() === nick.toLowerCase()
  );
  if (member?.profile.imageUrl) return;
  enqueue(serverId, nick);
}
