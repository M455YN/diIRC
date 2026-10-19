import { invoke } from "@tauri-apps/api/core";
import { getCurrentAppVersion } from "@/lib/changelog-service";
import { getServerActiveNick, useMockStore } from "@/lib/mock-store";
import { avatarKey, checkAvatar, isAvatarsEnabled } from "@/lib/avatars";
import { runQueued, sendLunaCtcp } from "@/lib/luna-ctcp";
import { logLuna } from "@/hooks/use-luna-log-store";
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
/** Set by the backend on a peer found through a VERSION probe (see `probeVersion`); never shown or stored. */
const PROBE_FEATURE = "ver";

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

/** Per server: does it relay the hello tag? Unknown until the first announce. */
const tagRelayed = new Map<string, boolean>();
const probed = new Set<string>();
/** A NAMES list longer than this is not probed: that many VERSION requests would be noise and a flood risk. */
const MAX_PROBES_PER_LIST = 30;

/**
 * Without the hello tag, asks a user once per session for its CTCP VERSION. Luna answers "Luna IRC <version>"
 * (see the backend) and is a peer from then on; other clients answer with their own name, which is dropped.
 * shortcut: other clients may show the request once in their server window, the tag path never does; use
 * the tag where the server relays it.
 */
export function probeVersion(serverId: string, rawNick: string) {
  if (!isPeersEnabled() || tagRelayed.get(serverId) !== false) return;
  const nick = rawNick.trim().replace(/^[~&@%+]+/, "");
  const server = useMockStore.getState().servers.find((s) => s.id === serverId);
  if (!nick || !server || nick.toLowerCase() === getServerActiveNick(server).toLowerCase()) return;
  const key = avatarKey(serverId, nick);
  if (isLunaPeer(serverId, nick) || probed.has(key)) return;
  if (!reserveProbe(serverId)) return; // over the limit: not marked as probed, a later join or list tries again
  probed.add(key);

  // Asked in the last PROBE_TTL_MS (in an earlier session too): reuse the answer instead of asking again.
  const verdicts = loadVerdicts();
  const verdict = verdicts[key];
  if (verdict && Date.now() - verdict.at < ttl(verdict)) {
    if (verdict.peer) useLunaPeerStore.getState().setPeer(key, verdict.peer);
    return;
  }
  verdicts[key] = { at: Date.now() };
  saveVerdicts(verdicts);
  sendLunaCtcp(serverId, nick, "VERSION");
}

/** At most this many new probes per server per minute, so a rejoin wave (a netsplit healing) cannot become a flood. */
const MAX_PROBES_PER_MINUTE = 20;
const probeTimes = new Map<string, number[]>();

function reserveProbe(serverId: string): boolean {
  const now = Date.now();
  const recent = (probeTimes.get(serverId) ?? []).filter((at) => now - at < 60_000);
  if (recent.length >= MAX_PROBES_PER_MINUTE) {
    probeTimes.set(serverId, recent);
    return false;
  }
  recent.push(now);
  probeTimes.set(serverId, recent);
  return true;
}

const VERDICTS_KEY = "luna-probe-verdicts";
const DAY_MS = 24 * 60 * 60 * 1000;
/** A stale "not a Luna" only delays finding a new Luna (which probes us anyway); a stale "is a Luna" would send Luna CTCPs to another client, so it expires sooner. */
const PROBE_TTL_MS = 7 * DAY_MS;
const PEER_TTL_MS = DAY_MS;
const ttl = (verdict: { peer?: unknown }) => (verdict.peer ? PEER_TTL_MS : PROBE_TTL_MS);
interface Verdict {
  at: number;
  peer?: LunaPeer;
}
let verdictCache: Record<string, Verdict> | null = null;

function loadVerdicts(): Record<string, Verdict> {
  if (verdictCache) return verdictCache;
  try {
    verdictCache = JSON.parse(localStorage.getItem(VERDICTS_KEY) ?? "{}") as Record<string, Verdict>;
  } catch {
    verdictCache = {};
  }
  return verdictCache;
}

function saveVerdicts(verdicts: Record<string, Verdict>) {
  for (const key of Object.keys(verdicts)) if (Date.now() - verdicts[key].at > ttl(verdicts[key])) delete verdicts[key];
  try {
    localStorage.setItem(VERDICTS_KEY, JSON.stringify(verdicts));
  } catch {
    // Storage unavailable: the answer is only remembered for this session.
  }
}

/** Probes the users of a roster (JOIN of one user, or a NAMES list that is not too long). */
export function probeVersions(serverId: string, nicks: string[]) {
  if (nicks.length <= MAX_PROBES_PER_LIST) nicks.forEach((nick) => probeVersion(serverId, nick));
}

/** Announces ourselves in a channel we just joined, without putting anything in the channel's chat. */
export async function announceHello(serverId: string, channel: string, force = false) {
  if (!isPeersEnabled()) return;
  const { version, features } = helloParts(serverId);
  try {
    // false = the server cannot relay the tag; then we ask the members for their VERSION instead.
    // Through the send queue: joining many channels at once must not fire one line per channel at the same moment.
    const sent = await runQueued(serverId, () => invoke<boolean>("send_luna_hello", { serverId, target: channel, value: `${version}:${features}` }), true);
    tagRelayed.set(serverId, sent);
    if (!sent) {
      // The roster arrives right after our JOIN; give it a moment.
      setTimeout(() => {
        const state = useMockStore.getState();
        const wanted = channel.toLowerCase().replace(/^#/, "");
        const found = state.servers.find((s) => s.id === serverId)?.channels.find((c) => c.name.toLowerCase().replace(/^#/, "") === wanted);
        const members = state.channelMembers[found?.id ?? ""] ?? [];
        probeVersions(serverId, members);
        // Peers we already know cannot hear our tag either: greet them directly (safe, they are Luna), so a
        // changed feature list (avatars switched on...) reaches them. They answer with theirs.
        // A peer in several of our channels is greeted once, not once per channel.
        for (const nick of members) {
          const key = avatarKey(serverId, nick);
          if (!isLunaPeer(serverId, nick) || Date.now() - (greeted.get(key) ?? 0) < (force ? GREET_BURST_MS : GREET_COOLDOWN_MS)) continue;
          greeted.set(key, Date.now());
          sendLunaCtcp(serverId, nick, helloBody(serverId), true);
        }
      }, 1500);
    }
    logLuna(serverId, "tx", sent ? `TAG ${channel} +lunairc/hello=${version}:${features}` : `TAG ${channel} hello not sent: the server does not relay client tags`);
  } catch (error) {
    console.warn("Luna hello failed:", error);
    logLuna(serverId, "tx", `TAG ${channel} hello failed: ${String(error)}`);
  }
}

/**
 * Announces ourselves again in every channel we are in, e.g. after avatars were switched on, so the
 * peers learn the new feature list (they answer with theirs).
 */
export function reannounceHello(serverId: string) {
  // Flicking a switch back and forth must not send one announcement per click: only the last state counts.
  clearTimeout(reannounceTimers.get(serverId));
  reannounceTimers.set(
    serverId,
    setTimeout(() => {
      reannounceTimers.delete(serverId);
      if (!isPeersEnabled()) return;
      const state = useMockStore.getState();
      const server = state.servers.find((s) => s.id === serverId);
      for (const channel of server?.channels ?? []) {
        if ((state.channelMembers[channel.id]?.length ?? 0) > 0) {
          void announceHello(serverId, channel.name.startsWith("#") ? channel.name : `#${channel.name}`, true);
        }
      }
    }, REANNOUNCE_DELAY_MS)
  );
}

const greeted = new Map<string, number>();
const GREET_COOLDOWN_MS = 10 * 60 * 1000;
/** A forced re-announce still greets a peer only once across all our channels. */
const GREET_BURST_MS = 10 * 1000;
const reannounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const REANNOUNCE_DELAY_MS = 5000;

export const isLunaPeer = (serverId: string, nick: string) =>
  avatarKey(serverId, nick) in useLunaPeerStore.getState().peers;

interface HelloEvent {
  serverId: string;
  sender: string;
  target: string;
  notice: boolean;
  body: string;
}

export function handleHelloEvent({ serverId, sender, target, body }: HelloEvent) {
  logLuna(serverId, "rx", `${isChannelName(target) ? `TAG ${target}` : "CTCP"} ${sender} LUNA HELLO ${body}${isPeersEnabled() ? "" : " (ignored: handshake off)"}`);
  if (!isPeersEnabled()) return;
  const parsed = parseHello(`HELLO ${body}`);
  if (!parsed) return;
  const server = useMockStore.getState().servers.find((s) => s.id === serverId);
  if (!server || sender.toLowerCase() === getServerActiveNick(server).toLowerCase()) return;

  // Found by our VERSION probe: only the version is known, so the real feature list is still to come.
  const fromProbe = parsed.features.includes(PROBE_FEATURE);
  const peer = { ...parsed, features: parsed.features.filter((feature) => feature !== PROBE_FEATURE) };
  const key = avatarKey(serverId, sender);
  const known = useLunaPeerStore.getState().peers[key];
  // The probe must not wipe features a real hello already told us about.
  if (!(fromProbe && known)) useLunaPeerStore.getState().setPeer(key, peer);
  // Remember a confirmed Luna, so the next session does not have to probe it again.
  const verdicts = loadVerdicts();
  if (verdicts[key]) {
    verdicts[key] = { at: Date.now(), peer: useLunaPeerStore.getState().peers[key] };
    saveVerdicts(verdicts);
  }

  // They announced themselves: let them know about us too (they may have joined after us). Replies are not answered,
  // but after a probe our hello is no reply: it asks them to answer with their features (avatars...).
  if (!peer.features.includes(REPLY_FEATURE) && Date.now() - (lastReplied.get(key) ?? 0) > REPLY_COOLDOWN_MS) {
    lastReplied.set(key, Date.now());
    sendLunaCtcp(serverId, sender, helloBody(serverId, !fromProbe), true);
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
