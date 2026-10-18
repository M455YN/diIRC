import { getServerActiveNick, useMockStore } from "@/lib/mock-store";
import { useAvatarStore } from "@/hooks/use-avatar-store";
import { useLunaPeerStore } from "@/hooks/use-luna-peer-store";
import { sendLunaCtcp } from "@/lib/luna-ctcp";

/*
 * Experimental Luna-to-Luna avatars over CTCP (`LUNAAVATAR`). Nothing is uploaded to a server or a
 * host: a 32x32 image travels as base64 chunks and is kept in each client's local storage.
 *
 *   PRIVMSG #chan  HASH <h|->       announcement of a new (or removed) avatar
 *   PRIVMSG nick   ?                "what is your current avatar?" (checked at most every 15 min)
 *   NOTICE  nick   HASH <h|->       answer to ?
 *   PRIVMSG nick   GET <h>          "send me that image"
 *   NOTICE  nick   DATA <h> <i>/<n> <chunk>
 */

const SIZE = 32;
const CHUNK_CHARS = 300;
const MAX_CHUNKS = 8;
const MAX_DATA_URL = CHUNK_CHARS * MAX_CHUNKS;
const RECHECK_MS = 15 * 60 * 1000;
const NON_LUNA_RECHECK_MS = 24 * 60 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;

const HASH_RE = /^[0-9a-f]{8}$/;
const DATA_URL_RE = /^data:image\/(?:webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;
const CHUNK_RE = /^[A-Za-z0-9+/=:;,\-./]+$/;

export const avatarKey = (serverId: string, nick: string) => `${serverId}|${nick.toLowerCase()}`;

const isChannel = (target: string) => target.startsWith("#") || target.startsWith("&");

/** The feature is opt-in twice: in the experimental settings and per server. */
export const isAvatarsEnabled = (serverId: string): boolean => {
  const state = useMockStore.getState();
  return Boolean(state.experimentalAvatars && state.servers.find((s) => s.id === serverId)?.avatarsEnabled);
};

export function hashDataUrl(dataUrl: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < dataUrl.length; i++) {
    hash ^= dataUrl.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function send(serverId: string, target: string, body: string, notice = false) {
  sendLunaCtcp(serverId, target, `LUNAAVATAR ${body}`, notice);
}

// ---- own avatar ----

/** Crops to a square and encodes a small image; throws if it cannot be made small enough. */
export async function fileToAvatarDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  const side = Math.min(bitmap.width, bitmap.height);
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  for (const [type, quality] of [["image/webp", 0.8], ["image/webp", 0.5], ["image/jpeg", 0.6], ["image/jpeg", 0.35]] as const) {
    const dataUrl = canvas.toDataURL(type, quality);
    if (dataUrl.startsWith(`data:${type}`) && DATA_URL_RE.test(dataUrl) && dataUrl.length <= MAX_DATA_URL) return dataUrl;
  }
  throw new Error("Image is too detailed to send as a small avatar");
}

/** Tells the channels of this server our current avatar hash (`-` when removed). */
export function announceOwnAvatar(serverId: string) {
  if (!isAvatarsEnabled(serverId)) return;
  const server = useMockStore.getState().servers.find((s) => s.id === serverId);
  const hash = useAvatarStore.getState().own[serverId]?.hash ?? "-";
  for (const channel of server?.channels ?? []) {
    send(serverId, channel.name.startsWith("#") ? channel.name : `#${channel.name}`, `HASH ${hash}`);
  }
}

export async function setOwnAvatar(serverId: string, file: File | null) {
  if (file) {
    const dataUrl = await fileToAvatarDataUrl(file);
    useAvatarStore.getState().setOwn(serverId, { hash: hashDataUrl(dataUrl), dataUrl });
  } else {
    useAvatarStore.getState().setOwn(serverId, null);
  }
  announceOwnAvatar(serverId);
}

// ---- receiving ----

const lunaPeers = new Set<string>(); // nicks that answered or announced this session
const lastChecked = new Map<string, number>();
const lastRequested = new Map<string, number>();
const lastServed = new Map<string, number>();
const incoming = new Map<string, { total: number; parts: string[]; startedAt: number }>();

/** Asks `nick` for their avatar hash, unless we checked recently (every 15 min for Luna users, daily otherwise). */
export function checkAvatar(serverId: string, nick: string) {
  if (!isAvatarsEnabled(serverId)) return;
  const server = useMockStore.getState().servers.find((s) => s.id === serverId);
  if (!server || nick.toLowerCase() === getServerActiveNick(server).toLowerCase()) return;
  const key = avatarKey(serverId, nick);
  const isLuna = lunaPeers.has(key) || key in useAvatarStore.getState().others || key in useLunaPeerStore.getState().peers;
  const last = lastChecked.get(key);
  if (last !== undefined && Date.now() - last < (isLuna ? RECHECK_MS : NON_LUNA_RECHECK_MS)) return;
  lastChecked.set(key, Date.now());
  send(serverId, nick, "?");
}

/**
 * Called for every message from someone else. With the Luna handshake on, only users who said hello
 * are asked, so other clients never receive our CTCPs.
 */
export function noteSpeaker(serverId: string, nick: string) {
  if (useMockStore.getState().lunaHandshake && !(avatarKey(serverId, nick) in useLunaPeerStore.getState().peers)) return;
  checkAvatar(serverId, nick);
}

interface AvatarEvent {
  serverId: string;
  sender: string;
  target: string;
  notice: boolean;
  body: string;
}

export function handleAvatarEvent({ serverId, sender, target, notice, body }: AvatarEvent) {
  if (!isAvatarsEnabled(serverId)) return;
  const [command, ...args] = body.trim().split(" ");
  const key = avatarKey(serverId, sender);
  const store = useAvatarStore.getState();
  lunaPeers.add(key);
  lastChecked.set(key, Date.now());

  if (command === "HASH") {
    const hash = args[0];
    if (hash === "-") store.setOther(key, null);
    else if (hash && HASH_RE.test(hash) && store.others[key]?.hash !== hash) {
      const requestKey = `${key}|${hash}`;
      if (Date.now() - (lastRequested.get(requestKey) ?? 0) < REQUEST_COOLDOWN_MS) return;
      lastRequested.set(requestKey, Date.now());
      send(serverId, sender, `GET ${hash}`);
    }
    return;
  }

  if (isChannel(target)) return; // requests and data are only valid when addressed to us

  if (command === "?" && !notice) {
    send(serverId, sender, `HASH ${store.own[serverId]?.hash ?? "-"}`, true);
  } else if (command === "GET" && !notice) {
    const own = store.own[serverId];
    if (!own || args[0] !== own.hash || Date.now() - (lastServed.get(key) ?? 0) < REQUEST_COOLDOWN_MS) return;
    lastServed.set(key, Date.now());
    const total = Math.ceil(own.dataUrl.length / CHUNK_CHARS);
    for (let i = 0; i < total; i++) {
      send(serverId, sender, `DATA ${own.hash} ${i + 1}/${total} ${own.dataUrl.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS)}`, true);
    }
  } else if (command === "DATA" && notice) {
    collectChunk(key, args);
  }
}

function collectChunk(key: string, [hash, position, chunk]: string[]) {
  if (!hash || !HASH_RE.test(hash) || !chunk || !CHUNK_RE.test(chunk) || chunk.length > CHUNK_CHARS) return;
  if (!lastRequested.has(`${key}|${hash}`)) return; // only data we asked for
  const [indexText, totalText] = (position ?? "").split("/");
  const index = Number(indexText);
  const total = Number(totalText);
  if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1 || total > MAX_CHUNKS || index < 1 || index > total) return;

  const bufferKey = `${key}|${hash}`;
  const now = Date.now();
  for (const [stale, entry] of incoming) if (now - entry.startedAt > 2 * 60 * 1000) incoming.delete(stale);
  const buffer = incoming.get(bufferKey) ?? { total, parts: [], startedAt: now };
  if (buffer.total !== total) return;
  buffer.parts[index - 1] = chunk;
  incoming.set(bufferKey, buffer);
  if (buffer.parts.filter(Boolean).length !== total) return;

  incoming.delete(bufferKey);
  const dataUrl = buffer.parts.join("");
  // The hash in the request must match the image we got, so a peer cannot swap in something else.
  if (!DATA_URL_RE.test(dataUrl) || dataUrl.length > MAX_DATA_URL || hashDataUrl(dataUrl) !== hash) return;
  useAvatarStore.getState().setOther(key, { hash, dataUrl });
}

// ---- display ----

/** The image to show for a user on a server, or undefined (use the generated avatar). */
export function useAvatarSrc(serverId: string | undefined, nick: string | undefined): string | undefined {
  const enabled = useMockStore((state) =>
    Boolean(state.experimentalAvatars && state.servers.find((s) => s.id === serverId)?.avatarsEnabled)
  );
  return useAvatarStore((state) => {
    if (!enabled || !serverId || !nick) return undefined;
    const server = useMockStore.getState().servers.find((s) => s.id === serverId);
    if (server && nick.toLowerCase() === getServerActiveNick(server).toLowerCase()) return state.own[serverId]?.dataUrl;
    return state.others[avatarKey(serverId, nick)]?.dataUrl;
  });
}
