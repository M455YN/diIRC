import { ask } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import i18n from "@/lib/i18n";
import { useMockStore } from "@/lib/mock-store";
import { ChannelType } from "@/types";

export const IRC_URL_RE = /^ircs?:\/\//i;

export interface IrcUrl {
  host: string;
  port: number;
  tls: boolean;
  channels: { name: string; key?: string }[];
}

const CHANNEL_PREFIX_RE = /^[#&+!]/;
// RFC-style target flags that follow the target after a comma (`irc://host/nick,isnick`).
const TARGET_FLAGS = new Set(["isnick", "isserver", "needkey", "needpass"]);

/** `irc://[user@]host[:port]/[#chan[,#chan2]][?key=secret]`, also `ircs://` (TLS). Null when it is not an IRC link. */
export function parseIrcUrl(raw: string): IrcUrl | null {
  if (!IRC_URL_RE.test(raw)) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!url.hostname) return null;
  const tls = url.protocol.toLowerCase() === "ircs:";
  const port = url.port ? Number(url.port) : tls ? 6697 : 6667;
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;

  // A `#` is the URL fragment, so `irc://host/#general` carries the channel there; `irc://host/general` in the path.
  let target = "";
  try {
    target = decodeURIComponent(url.pathname.replace(/^\//, "")) || decodeURIComponent(url.hash);
  } catch {
    return null;
  }
  const key = url.searchParams.get("key") ?? undefined;
  const channels = target
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && !TARGET_FLAGS.has(part.toLowerCase()))
    .map((name) => ({ name: CHANNEL_PREFIX_RE.test(name) ? name : `#${name}`, key }))
    .filter((channel) => channel.name.length > 1);
  return { host: url.hostname.toLowerCase(), port, tls, channels };
}

// Callers outside React (link clicks in rendered messages) have no router handle.
const pushPath = (path: string) => {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
};

/**
 * Opens an irc:// link: joins its channels on a server we already have, or (after asking) adds the
 * server first. Returns the id of the server it ended up on.
 */
export async function openIrcUrl(
  raw: string,
  navigate?: (path: string) => void
): Promise<string | null> {
  const target = parseIrcUrl(raw);
  if (!target) return null;
  const store = useMockStore.getState();

  let server = store.servers.find(
    (s) => (s.host || "").toLowerCase() === target.host && (s.port || 6667) === target.port
  );
  if (!server) {
    const channels = target.channels.map((c) => c.name).join(", ");
    const confirmed = await ask(
      i18n.t("ircUrl.addServer", {
        host: `${target.host}:${target.port}${target.tls ? " (TLS)" : ""}`,
        channels: channels || "-",
      }),
      { title: i18n.t("ircUrl.title"), kind: "info" }
    ).catch(() => false);
    if (!confirmed) return null;
    server = store.addServer({
      name: target.host,
      host: target.host,
      port: target.port,
      nicknames: [store.currentProfile.name.replace(/\s+/g, "") || "ReactUser"],
      useTls: target.tls,
      autoConnect: true,
      autoReconnect: true,
    });
  }

  const serverId = server.id;
  const connected = !!useMockStore.getState().ircConnectedServers[serverId];
  for (const { name, key } of target.channels) {
    const channelName = name.replace(/^#/, "");
    const state = useMockStore.getState();
    state.setPendingJoin(serverId, channelName, key);
    const channel = state.addChannel(serverId, channelName, ChannelType.TEXT);
    if (key) state.updateChannelKey(serverId, channel.id, key);
    // Not connected yet: the channel list is joined on connect.
    if (connected) await invoke("join_channel", { serverId, channel: channelName, password: key ?? null }).catch(console.error);
  }
  if (!connected) await useMockStore.getState().connectServer(serverId);
  (navigate ?? pushPath)(`/servers/${serverId}`);
  return serverId;
}
