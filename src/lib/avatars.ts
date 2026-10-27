import { getServerActiveNick, useMockStore } from "@/lib/mock-store";
import { useAvatarStore } from "@/hooks/use-avatar-store";
import { useLunaPeerStore } from "@/hooks/use-luna-peer-store";
import { sendLunaCtcp, SEND_SPACING_MS } from "@/lib/luna-ctcp";
import { logLuna } from "@/hooks/use-luna-log-store";
import { encodeAnimatedGif, resizeLanczos3, type GifFrame, type Rgba } from "@/lib/avatar-image";

/*
 * Experimental Luna-to-Luna avatars over CTCP (`LUNAAVATAR`). Nothing is uploaded to a server or a
 * host: a 32x32 image travels as base64 chunks and is kept in each client's local storage.
 *
 * The image is a 64x64 WebP/JPEG/PNG, or a 32x32 GIF when the source is animated.
 *
 *   NOTICE  nick   HASH <h|->       announcement of a new (or removed) avatar, to Luna users with avatars
 *   PRIVMSG nick   ?                "what is your current avatar?" (checked at most every 15 min)
 *   NOTICE  nick   HASH <h|->       answer to ?
 *   PRIVMSG nick   GET <h>          "send me that image"
 *   NOTICE  nick   DATA <h> <i>/<n> <chunk>
 */

/** Animations stay small to fit the chunk budget; stills get more pixels so they stay sharp when shown larger. */
const ANIMATED_SIZE = 32;
const STILL_SIZE = 64;
const CHUNK_CHARS = 300;
const MAX_CHUNKS = 24;
const MAX_DATA_URL = CHUNK_CHARS * MAX_CHUNKS;
/** Largest animated GIF (bytes) that still fits in `MAX_DATA_URL` once base64-encoded. */
const MAX_GIF_BYTES = Math.floor(((MAX_DATA_URL - "data:image/gif;base64,".length) * 3) / 4) - 3;
/** Sources bigger than this are shrunk once by the browser before the Lanczos pass (memory). */
const SOURCE_LIMIT = 2048;
const MAX_SOURCE_FRAMES = 60;
const RECHECK_MS = 15 * 60 * 1000;
const NON_LUNA_RECHECK_MS = 24 * 60 * 60 * 1000;
const REQUEST_COOLDOWN_MS = 60 * 1000;
/** A "?" is answered at most this often per nick: anyone can ask, and the answer is a message we send. */
const HASH_REPLY_COOLDOWN_MS = 10 * 1000;
/** Avatar transfers go out one after another; a request that would wait longer than this is dropped (it asks again later). */
const MAX_SERVE_BACKLOG_MS = 60 * 1000;

const HASH_RE = /^[0-9a-f]{8}$/;
const DATA_URL_RE = /^data:image\/(?:webp|jpeg|png|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
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

function send(serverId: string, target: string, body: string, notice = false, urgent = false) {
  sendLunaCtcp(serverId, target, `LUNAAVATAR ${body}`, notice, urgent);
}

// ---- own avatar ----

/** A square window into the source image, in source pixels. */
export interface AvatarCrop {
  x: number;
  y: number;
  side: number;
}

/** Draws the crop (default: the centred square) of `source` and returns its pixels (at most `SOURCE_LIMIT` wide). */
function readSquare(source: CanvasImageSource, width: number, height: number, crop?: AvatarCrop): Rgba {
  const side = crop?.side ?? Math.min(width, height);
  const sx = crop?.x ?? (width - side) / 2;
  const sy = crop?.y ?? (height - side) / 2;
  const target = Math.max(1, Math.min(Math.round(side), SOURCE_LIMIT));
  const canvas = document.createElement("canvas");
  canvas.width = target;
  canvas.height = target;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas is not available");
  context.imageSmoothingQuality = "high";
  context.drawImage(source, sx, sy, side, side, 0, 0, target, target);
  const image = context.getImageData(0, 0, target, target);
  return { data: image.data, width: target, height: target };
}

interface DecodedFrame {
  image: CanvasImageSource & { displayWidth: number; displayHeight: number; duration: number | null; close(): void };
}

interface FrameDecoder {
  tracks: { ready: Promise<void>; selectedTrack?: { frameCount: number } };
  decode(options: { frameIndex: number }): Promise<DecodedFrame>;
  close(): void;
}

interface FrameDecoderConstructor {
  new (init: { data: ArrayBuffer; type: string }): FrameDecoder;
  isTypeSupported(type: string): Promise<boolean>;
}

/** The frames of an animated image (GIF, animated WebP/PNG), scaled to avatar size; null for a still image. */
async function decodeAnimation(file: File, crop?: AvatarCrop): Promise<GifFrame[] | null> {
  const Decoder = (globalThis as unknown as { ImageDecoder?: FrameDecoderConstructor }).ImageDecoder;
  if (!Decoder || !file.type || !(await Decoder.isTypeSupported(file.type))) return null;
  const decoder = new Decoder({ data: await file.arrayBuffer(), type: file.type });
  try {
    await decoder.tracks.ready;
    const count = decoder.tracks.selectedTrack?.frameCount ?? 1;
    if (count < 2) return null;
    const step = Math.ceil(count / MAX_SOURCE_FRAMES);
    const frames: GifFrame[] = [];
    for (let index = 0; index < count; index += step) {
      const { image } = await decoder.decode({ frameIndex: index });
      const duration = image.duration ?? 100_000; // microseconds
      const pixels = readSquare(image, image.displayWidth, image.displayHeight, crop);
      image.close();
      frames.push({ rgba: resizeLanczos3(pixels, ANIMATED_SIZE), delayCs: Math.max(2, Math.round((duration * step) / 10_000)) });
    }
    return frames;
  } finally {
    decoder.close();
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/**
 * Crops to a square and encodes a small image: Lanczos3-scaled, as a GIF when the source is animated
 * (and the animation can be made small enough), else as WebP/JPEG. Throws if it cannot be made small enough.
 */
export async function fileToAvatarDataUrl(file: File, crop?: AvatarCrop): Promise<string> {
  const frames = await decodeAnimation(file, crop).catch(() => null);
  if (frames) {
    const gif = encodeAnimatedGif(ANIMATED_SIZE, frames, MAX_GIF_BYTES);
    if (gif) {
      const dataUrl = `data:image/gif;base64,${bytesToBase64(gif)}`;
      if (DATA_URL_RE.test(dataUrl) && dataUrl.length <= MAX_DATA_URL) return dataUrl;
    }
    // Too detailed to animate within the size budget: fall back to a still of the first frame.
  }

  const bitmap = await createImageBitmap(file);
  const pixels = readSquare(bitmap, bitmap.width, bitmap.height, crop);
  bitmap.close();
  const canvas = document.createElement("canvas");
  canvas.width = STILL_SIZE;
  canvas.height = STILL_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.putImageData(new ImageData(resizeLanczos3(pixels, STILL_SIZE), STILL_SIZE, STILL_SIZE), 0, 0);
  // Highest quality that fits the chunk budget; lossless WebP would not.
  for (const [type, quality] of [["image/webp", 0.95], ["image/webp", 0.8], ["image/webp", 0.5], ["image/jpeg", 0.6], ["image/jpeg", 0.35]] as const) {
    const dataUrl = canvas.toDataURL(type, quality);
    if (dataUrl.startsWith(`data:${type}`) && DATA_URL_RE.test(dataUrl) && dataUrl.length <= MAX_DATA_URL) return dataUrl;
  }
  throw new Error("Image is too detailed to send as a small avatar");
}

/** Whether `nick` said (via the Luna handshake) that it understands avatars. */
const hasAvatarFeature = (serverId: string, nick: string) =>
  Boolean(useLunaPeerStore.getState().peers[avatarKey(serverId, nick)]?.features.includes("avatar"));

/**
 * Tells the Luna users who share a channel with us and have avatars on our current avatar hash
 * (`-` when removed). It goes to each of them as a private NOTICE, never to the channel: everyone
 * else (other IRC clients, Lunas with avatars off) would otherwise see the CTCP as noise.
 */
export function announceOwnAvatar(serverId: string) {
  if (!isAvatarsEnabled(serverId)) return;
  const state = useMockStore.getState();
  const server = state.servers.find((s) => s.id === serverId);
  if (!server) return;
  const hash = useAvatarStore.getState().own[serverId]?.hash ?? "-";
  const ourNick = getServerActiveNick(server).toLowerCase();
  const recipients = new Map<string, string>();
  for (const channel of server.channels) {
    for (const nick of state.channelMembers[channel.id] ?? []) {
      if (nick.toLowerCase() !== ourNick && hasAvatarFeature(serverId, nick)) recipients.set(nick.toLowerCase(), nick);
    }
  }
  for (const nick of recipients.values()) send(serverId, nick, `HASH ${hash}`, true, true);
}

export async function setOwnAvatar(serverId: string, file: File | null, crop?: AvatarCrop) {
  if (file) {
    const dataUrl = await fileToAvatarDataUrl(file, crop);
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
const lastHashReply = new Map<string, number>();
let nextServeAt = 0; // when the transfer queue is free again
const lastServed = new Map<string, number>(); // keyed `nick|hash`: a new avatar is served at once, a repeated request is not
const incoming = new Map<string, { total: number; parts: string[]; startedAt: number }>();

/** Asks `nick` for their avatar hash, unless we checked recently (every 15 min for Luna users, daily otherwise). */
export function checkAvatar(serverId: string, nick: string) {
  if (!isAvatarsEnabled(serverId)) return;
  const server = useMockStore.getState().servers.find((s) => s.id === serverId);
  if (!server || nick.toLowerCase() === getServerActiveNick(server).toLowerCase()) return;
  // Only users who said (in the handshake) that they have avatars get our CTCP; the rest would see it as noise.
  if (!hasAvatarFeature(serverId, nick)) return;
  const key = avatarKey(serverId, nick);
  const isLuna = lunaPeers.has(key) || key in useAvatarStore.getState().others || key in useLunaPeerStore.getState().peers;
  const last = lastChecked.get(key);
  if (last !== undefined && Date.now() - last < (isLuna ? RECHECK_MS : NON_LUNA_RECHECK_MS)) return;
  lastChecked.set(key, Date.now());
  send(serverId, nick, "?");
}

/**
 * Called for every message from someone else. Only users who said hello with the avatar feature are
 * asked, so other clients never receive our CTCPs.
 */
export function noteSpeaker(serverId: string, nick: string) {
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
  logLuna(serverId, "rx", `CTCP ${sender} LUNAAVATAR ${body}${isAvatarsEnabled(serverId) ? "" : " (ignored: avatars off)"}`);
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
    if (Date.now() - (lastHashReply.get(key) ?? 0) < HASH_REPLY_COOLDOWN_MS) return;
    lastHashReply.set(key, Date.now());
    send(serverId, sender, `HASH ${store.own[serverId]?.hash ?? "-"}`, true);
  } else if (command === "GET" && !notice) {
    const own = store.own[serverId];
    const servedKey = `${key}|${args[0]}`;
    if (!own || args[0] !== own.hash || Date.now() - (lastServed.get(servedKey) ?? 0) < REQUEST_COOLDOWN_MS) return;
    const total = Math.ceil(own.dataUrl.length / CHUNK_CHARS);
    // One transfer at a time: with many peers asking at once, each starts when the previous one has been sent.
    const startAt = Math.max(Date.now(), nextServeAt);
    if (startAt - Date.now() > MAX_SERVE_BACKLOG_MS) return;
    lastServed.set(servedKey, Date.now());
    nextServeAt = startAt + total * SEND_SPACING_MS;
    const dataUrl = own.dataUrl;
    const hash = own.hash;
    setTimeout(() => {
      for (let i = 0; i < total; i++) {
        send(serverId, sender, `DATA ${hash} ${i + 1}/${total} ${dataUrl.slice(i * CHUNK_CHARS, (i + 1) * CHUNK_CHARS)}`, true, true);
      }
    }, startAt - Date.now());
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
