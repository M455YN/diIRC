import { getCurrentAppVersion } from "@/lib/changelog-service";
import { getServerActiveNick, useMockStore } from "@/lib/mock-store";
import { avatarKey, checkAvatar, isAvatarsEnabled } from "@/lib/avatars";
import { sendLunaCtcp } from "@/lib/luna-ctcp";
import { useLunaPeerStore, type LunaPeer } from "@/hooks/use-luna-peer-store";

/*
 * Handshake that tells Luna clients apart from everyone else, so Luna-only features
 * (reactions, avatars, ...) are only sent to users who understand them.
 *
 *   PRIVMSG #chan  LUNA HELLO <version> <feature,feature,...>   we joined a channel
 *   NOTICE  nick   LUNA HELLO <version> <feature,feature,...>   answer to the above, once per peer
 */

const VERSION_RE = /^[0-9A-Za-z.+-]{1,24}$/;
const FEATURE_RE = /^[a-z]{1,16}$/;
const MAX_FEATURES = 12;
const REPLY_COOLDOWN_MS = 10 * 60 * 1000;

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

function helloBody(serverId: string): string {
  const features = ["react"];
  if (isAvatarsEnabled(serverId)) features.push("avatar");
  return `LUNA HELLO ${getCurrentAppVersion()} ${features.join(",")}`;
}

/** Announces ourselves in a channel we just joined. */
export function announceHello(serverId: string, channel: string) {
  if (!isPeersEnabled()) return;
  sendLunaCtcp(serverId, channel, helloBody(serverId));
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

export function handleHelloEvent({ serverId, sender, notice, body }: HelloEvent) {
  if (!isPeersEnabled()) return;
  const peer = parseHello(`HELLO ${body}`);
  if (!peer) return;
  const server = useMockStore.getState().servers.find((s) => s.id === serverId);
  if (!server || sender.toLowerCase() === getServerActiveNick(server).toLowerCase()) return;

  const key = avatarKey(serverId, sender);
  useLunaPeerStore.getState().setPeer(key, peer);

  // They announced themselves to the channel: let them know about us too (they may have joined after us).
  if (!notice && Date.now() - (lastReplied.get(key) ?? 0) > REPLY_COOLDOWN_MS) {
    lastReplied.set(key, Date.now());
    sendLunaCtcp(serverId, sender, helloBody(serverId), true);
  }
  if (peer.features.includes("avatar")) checkAvatar(serverId, sender);
}

/**
 * Whether anyone who could show a Luna-only message is known: a Luna user among the members of that
 * channel, or the peer of a private chat. Without any, sending the CTCP would only reach clients
 * that cannot use it.
 */
export function hasLunaPeerFor(serverId: string, target: string): boolean {
  const store = useMockStore.getState();
  if (!/^[#&+!]/.test(target)) return isLunaPeer(serverId, target);
  const channel = store.servers
    .find((s) => s.id === serverId)
    ?.channels.find((c) => c.name.toLowerCase().replace(/^#/, "") === target.toLowerCase().replace(/^#/, ""));
  return (store.channelMembers[channel?.id ?? ""] ?? []).some((nick) => isLunaPeer(serverId, nick));
}
