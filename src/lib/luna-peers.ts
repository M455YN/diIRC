import { invoke } from "@tauri-apps/api/core";
import { getCurrentAppVersion } from "@/lib/changelog-service";
import { getServerActiveNick, useMockStore } from "@/lib/mock-store";
import { avatarKey, checkAvatar, isAvatarsEnabled } from "@/lib/avatars";
import { sendLunaCtcp } from "@/lib/luna-ctcp";
import { useLunaPeerStore, type LunaPeer } from "@/hooks/use-luna-peer-store";

/*
 * Handshake that tells Luna clients apart from everyone else, so Luna-only features
 * (reactions, avatars, ...) are only sent to users who understand them.
 *
 * Nothing Luna sends to another Luna is ever a line in a channel. Every Luna CTCP goes to one user
 * at a time, and only to users who said hello, so other clients never see any of it.
 *
 *   TAGMSG  #chan  +lunairc/hello=<version>:<features>   we joined a channel (a tag, not a chat line)
 *   NOTICE  nick   LUNA HELLO <version> <features>,re    answer to a hello, once per peer ("re" = a reply)
 *
 * Without message-tags on the server the tag cannot travel and nobody is greeted: a NOTICE to people who
 * may not run Luna would show up in their client, and that must never happen. Peers are therefore only
 * ever users who sent a hello themselves.
 */

const VERSION_RE = /^[0-9A-Za-z.+-]{1,24}$/;
const FEATURE_RE = /^[a-z]{1,16}$/;
const MAX_FEATURES = 12;
const REPLY_COOLDOWN_MS = 10 * 60 * 1000;
/** Marks a hello that answers another one, so replies are never answered again. */
const REPLY_FEATURE = "re";

const lastReplied = new Map<string, number>();

export const isPeersEnabled = () => useMockStore.getState().lunaHandshake;

/** `HELLO <version> <features>` → peer, or null when malformed. */
export function parseHello(text: string): LunaPeer | null {
  const [command, version, features = ""] = text.trim().split(/\s+/);
  if (command !== "HELLO" || !version || !VERSION_RE.test(version)) return null;
  const list = features.split(",").filter(Boolean);
  if (list.length > MAX_FEATURES || !list.every((feature) => FEATURE_RE.test(feature))) return null;
  return { version, features: list };
}

function helloParts(serverId: string, reply = false): { version: string; features: string } {
  const features = ["react"];
  if (isAvatarsEnabled(serverId)) features.push("avatar");
  if (reply) features.push(REPLY_FEATURE);
  return { version: getCurrentAppVersion(), features: features.join(",") };
}

function helloBody(serverId: string, reply = false): string {
  const { version, features } = helloParts(serverId, reply);
  return `LUNA HELLO ${version} ${features}`;
}

/** Announces ourselves in a channel we just joined, without putting anything in the channel's chat. */
export async function announceHello(serverId: string, channel: string) {
  if (!isPeersEnabled()) return;
  const { version, features } = helloParts(serverId);
  try {
    // false = the server cannot relay the tag; then nothing is sent (see the note at the top).
    await invoke<boolean>("send_luna_hello", { serverId, target: channel, value: `${version}:${features}` });
  } catch (error) {
    console.warn("Luna hello failed:", error);
  }
}

/**
 * Announces ourselves again in every channel we are in, e.g. after avatars were switched on, so the
 * peers learn the new feature list (they answer with theirs).
 */
export function reannounceHello(serverId: string) {
  if (!isPeersEnabled()) return;
  const state = useMockStore.getState();
  const server = state.servers.find((s) => s.id === serverId);
  for (const channel of server?.channels ?? []) {
    if ((state.channelMembers[channel.id]?.length ?? 0) > 0) {
      void announceHello(serverId, channel.name.startsWith("#") ? channel.name : `#${channel.name}`);
    }
  }
}

export const isLunaPeer = (serverId: string, nick: string) =>
  avatarKey(serverId, nick) in useLunaPeerStore.getState().peers;

interface HelloEvent {
  serverId: string;
  sender: string;
  target: string;
  notice: boolean;
  body: string;
}

export function handleHelloEvent({ serverId, sender, body }: HelloEvent) {
  if (!isPeersEnabled()) return;
  const peer = parseHello(`HELLO ${body}`);
  if (!peer) return;
  const server = useMockStore.getState().servers.find((s) => s.id === serverId);
  if (!server || sender.toLowerCase() === getServerActiveNick(server).toLowerCase()) return;

  const key = avatarKey(serverId, sender);
  useLunaPeerStore.getState().setPeer(key, peer);

  // They announced themselves: let them know about us too (they may have joined after us). Replies are not answered.
  if (!peer.features.includes(REPLY_FEATURE) && Date.now() - (lastReplied.get(key) ?? 0) > REPLY_COOLDOWN_MS) {
    lastReplied.set(key, Date.now());
    sendLunaCtcp(serverId, sender, helloBody(serverId, true), true);
  }
  if (peer.features.includes("avatar")) checkAvatar(serverId, sender);
}

const isChannelName = (target: string) => /^[#&+!]/.test(target);

/**
 * The Luna users a Luna-only message to `target` should reach, one by one: the Luna users among the
 * members of that channel, or the peer of a private chat. Empty when nobody could show it, in which
 * case nothing is sent at all.
 */
export function lunaPeersFor(serverId: string, target: string): string[] {
  const store = useMockStore.getState();
  if (!isChannelName(target)) return isLunaPeer(serverId, target) ? [target] : [];
  const server = store.servers.find((s) => s.id === serverId);
  const channel = server?.channels.find((c) => c.name.toLowerCase().replace(/^#/, "") === target.toLowerCase().replace(/^#/, ""));
  const own = server ? getServerActiveNick(server).toLowerCase() : "";
  return (store.channelMembers[channel?.id ?? ""] ?? []).filter(
    (nick) => nick.toLowerCase() !== own && isLunaPeer(serverId, nick)
  );
}
