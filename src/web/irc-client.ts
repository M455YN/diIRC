// Browser IRC client: replaces the Rust backend (src-tauri/src/lib.rs) over WebSocket.
// Covers the core of what the frontend consumes; message edit/redact and the raw log are not implemented.
import { emit } from "./bus";
import { formatLine, parseLine, type IrcLine } from "./irc-line";
import { appendLog, localTimestamp } from "./log-db";

export interface ConnectParams {
  serverId: string;
  host: string;
  port: number;
  nicknames: string[];
  username?: string;
  realname?: string;
  password?: string;
  channels?: { name: string; password?: string }[];
  useTls?: boolean;
  parseLegacyZncTimestamps?: boolean;
  onConnectCommands?: string[];
}
interface Member {
  nick: string;
  modes: Set<string>;
}
interface Chan {
  name: string;
  members: Map<string, Member>;
}
interface Conn {
  id: string;
  ws: WebSocket;
  p: ConnectParams;
  nick: string;
  nickIdx: number;
  registered: boolean;
  closing: boolean;
  caps: Set<string>;
  capsAvail: Set<string>;
  capsPending: boolean;
  prefixes: [string, string][]; // [mode, symbol], highest first
  chans: Map<string, Chan>;
  names: Map<string, string[]>;
  motd: string[];
}

const WANT = [
  "server-time",
  "znc.in/server-time-iso",
  "message-tags",
  "multi-prefix",
  "userhost-in-names",
  "extended-join",
  "away-notify",
  "batch",
  "znc.in/self-message",
];
const conns = new Map<string, Conn>();
let ignoreMasks: RegExp[] = [];
let quitMessage = "";

const isChan = (t: string) => /^[#&]/.test(t);
const lc = (s: string) => s.toLowerCase();
const ctcp = (s: string) => `\x01${s}\x01`;

// Open the app once as https://host/#token=SECRET to store the bridge token (no console needed on iPhone).
try {
  const t = new URLSearchParams(location.hash.slice(1)).get("token");
  if (t) {
    localStorage.setItem("luna.bridgeToken", t);
    history.replaceState(null, "", location.pathname + location.search);
  }
} catch {
  /* storage unavailable */
}

export function setIgnoreList(patterns: string[]) {
  ignoreMasks = patterns.map((m) => {
    const full = m.includes("!") || m.includes("@") ? m : `${m}!*@*`;
    return new RegExp("^" + full.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i");
  });
}
export const setQuitMessage = (m: string) => {
  quitMessage = m;
};

function wsUrl(p: ConnectParams): string {
  if (/^wss?:\/\//i.test(p.host)) return p.host; // server speaks IRC-over-WebSocket itself
  const read = (k: string) => {
    try {
      return localStorage.getItem(k) ?? "";
    } catch {
      return "";
    }
  };
  const base = read("luna.bridge") || `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/irc`;
  const q = new URLSearchParams({ host: p.host, port: String(p.port), tls: p.useTls ? "1" : "0", token: read("luna.bridgeToken") });
  return `${base}?${q}`;
}

function send(c: Conn, cmd: string, params: string[] = [], tags?: Record<string, string>) {
  if (c.ws.readyState !== WebSocket.OPEN) throw "Not connected";
  c.ws.send(formatLine(cmd, params, tags));
}
const get = (id: string) => {
  const c = conns.get(id);
  if (!c) throw "Not connected";
  return c;
};

const sys = (c: Conn, channel: string, content: string) =>
  emit("irc_message", { server_id: c.id, sender: "System", content, channel, is_system: true, timestamp: null, msgid: null, reply_to_msgid: null, reply_nick: null, reply_preview: null, log_id: null });
const userEvent = (c: Conn, channel: string, users: string[], event_type: string) =>
  emit("irc_user_event", { server_id: c.id, channel, users, event_type });

const symbolOf = (c: Conn, m: Member) => c.prefixes.find(([mode]) => m.modes.has(mode))?.[1] ?? "";
const roster = (c: Conn, ch: Chan) => [...ch.members.values()].map((m) => symbolOf(c, m) + m.nick);
function emitOps(c: Conn, ch: Chan) {
  const ops = [...ch.members.values()].filter((m) => ["q", "a", "o"].some((x) => m.modes.has(x))).map((m) => m.nick);
  emit("irc_ops_event", { server_id: c.id, channel: ch.name, ops });
}

export function connect(p: ConnectParams): Promise<void> {
  conns.get(p.serverId)?.ws.close();
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl(p), "text.ircv3.net");
    const c: Conn = {
      id: p.serverId, ws, p, nick: p.nicknames[0] ?? "luna", nickIdx: 0, registered: false, closing: false,
      caps: new Set(), capsAvail: new Set(), capsPending: false,
      prefixes: [["q", "~"], ["a", "&"], ["o", "@"], ["h", "%"], ["v", "+"]],
      chans: new Map(), names: new Map(), motd: [],
    };
    conns.set(p.serverId, c);
    ws.onopen = () => {
      resolve();
      ws.send("CAP LS 302");
      if (p.password) ws.send(formatLine("PASS", [p.password]));
      ws.send(formatLine("NICK", [c.nick]));
      ws.send(formatLine("USER", [p.username || c.nick, "0", "*", p.realname || c.nick]));
    };
    ws.onmessage = (e) => {
      for (const raw of String(e.data).split(/\r?\n/)) {
        const l = parseLine(raw);
        if (l) void handle(c, l).catch((err) => console.error("[irc]", raw, err));
      }
    };
    ws.onerror = () => {
      if (!c.registered) reject("WebSocket connection failed");
    };
    ws.onclose = () => {
      if (conns.get(c.id) === c) conns.delete(c.id);
      emit("irc_status", { server_id: c.id, connected: false, error: c.closing ? null : "Connection closed" });
    };
  });
}

export function disconnect(id: string) {
  const c = conns.get(id);
  if (!c) return;
  c.closing = true;
  try {
    send(c, "QUIT", [quitMessage || "Luna IRC"]);
  } catch {
    /* already closed */
  }
  setTimeout(() => c.ws.close(), 300);
}

const logTarget = (target: string, sender: string, self: boolean) => (isChan(target) || self ? target : sender);

async function handle(c: Conn, l: IrcLine) {
  const isMe = (n: string) => lc(n) === lc(c.nick);
  const time = l.tags["time"] || l.tags["znc.in/server-time-iso"] || undefined;
  switch (l.cmd) {
    case "PING":
      return send(c, "PONG", l.params);
    case "CAP": {
      const sub = l.params[1];
      const list = (l.params[l.params.length - 1] ?? "").split(" ").filter(Boolean);
      if (sub === "LS") {
        list.forEach((x) => c.capsAvail.add(x.split("=")[0]));
        if (l.params[2] === "*") return;
        const req = WANT.filter((x) => c.capsAvail.has(x));
        if (req.length) {
          c.capsPending = true;
          send(c, "CAP", ["REQ", req.join(" ")]);
        } else send(c, "CAP", ["END"]);
      } else if (sub === "ACK" || sub === "NAK") {
        if (sub === "ACK") list.forEach((x) => c.caps.add(x));
        if (c.capsPending) {
          c.capsPending = false;
          send(c, "CAP", ["END"]);
        }
      }
      return;
    }
    case "001":
      c.nick = l.params[0];
      c.registered = true;
      emit("irc_welcome_nick", { server_id: c.id, welcome_nick: c.nick });
      emit("irc_status", { server_id: c.id, connected: true, error: null });
      void startup(c);
      return;
    case "005": {
      const m = /PREFIX=\(([^)]*)\)(\S*)/.exec(l.params.join(" "));
      if (m) c.prefixes = [...m[1]].map((mode, i) => [mode, m[2][i]] as [string, string]);
      return;
    }
    case "432":
    case "433":
      c.nick = c.p.nicknames[++c.nickIdx] ?? c.nick + "_";
      if (!c.registered) send(c, "NICK", [c.nick]);
      return;
    case "375":
      c.motd = [];
      return;
    case "372":
    case "377":
    case "378":
      c.motd.push(l.params[1] ?? "");
      return;
    case "376":
    case "422":
      emit("irc_motd_event", { server_id: c.id, motd: c.motd });
      return;
    case "PRIVMSG":
    case "NOTICE":
      return message(c, l, time);
    case "TAGMSG": {
      const state = l.tags["+typing"];
      if (state && l.nick && !isMe(l.nick)) {
        emit("irc_typing", { serverId: c.id, target: logTarget(l.params[0], l.nick, false), sender: l.nick, state });
      }
      return;
    }
    case "JOIN": {
      const name = l.params[0];
      if (l.host) emit("irc_user_host_event", { server_id: c.id, nick: l.nick, host: l.user ? `${l.user}@${l.host}` : l.host, realname: l.params[2] || null });
      if (isMe(l.nick)) c.chans.set(lc(name), { name, members: new Map() });
      c.chans.get(lc(name))?.members.set(lc(l.nick), { nick: l.nick, modes: new Set() });
      userEvent(c, name, [l.nick], "JOIN");
      return;
    }
    case "PART":
    case "KICK": {
      const ch = c.chans.get(lc(l.params[0]));
      const name = ch?.name ?? l.params[0];
      const who = l.cmd === "KICK" ? l.params[1] : l.nick;
      ch?.members.delete(lc(who));
      if (isMe(who)) c.chans.delete(lc(name));
      userEvent(c, name, [who], l.cmd);
      if (l.cmd === "KICK") sys(c, name, `${who} was kicked by ${l.nick}${l.params[2] ? ` (${l.params[2]})` : ""}`);
      if (ch) emitOps(c, ch);
      return;
    }
    case "QUIT":
      for (const ch of c.chans.values()) if (ch.members.delete(lc(l.nick))) userEvent(c, ch.name, [l.nick], "QUIT");
      return;
    case "NICK": {
      const newNick = l.params[0];
      if (isMe(l.nick)) {
        c.nick = newNick;
        emit("irc_welcome_nick", { server_id: c.id, welcome_nick: newNick });
      }
      for (const { members } of c.chans.values()) {
        const m = members.get(lc(l.nick));
        if (m) {
          members.delete(lc(l.nick));
          m.nick = newNick;
          members.set(lc(newNick), m);
        }
      }
      emit("irc_nick_change", { server_id: c.id, old_nick: l.nick, new_nick: newNick });
      return;
    }
    case "TOPIC":
      emit("irc_topic_event", { server_id: c.id, channel: l.params[0], topic: l.params[1] ?? "", set_by: l.nick });
      return;
    case "332":
      emit("irc_topic_event", { server_id: c.id, channel: l.params[1], topic: l.params[2] ?? "", set_by: null });
      return;
    case "353": {
      const key = lc(l.params[2]);
      c.names.set(key, [...(c.names.get(key) ?? []), ...(l.params[3] ?? "").split(" ").filter(Boolean)]);
      return;
    }
    case "366": {
      const name = l.params[1];
      const raw = c.names.get(lc(name)) ?? [];
      c.names.delete(lc(name));
      const syms = c.prefixes.map(([, s]) => s).join("");
      const members = new Map<string, Member>();
      for (const entry of raw) {
        let i = 0;
        const modes = new Set<string>();
        while (i < entry.length && syms.includes(entry[i])) modes.add(c.prefixes.find(([, s]) => s === entry[i++])![0]);
        const nick = entry.slice(i).split("!")[0];
        members.set(lc(nick), { nick, modes });
      }
      const ch = { name, members };
      c.chans.set(lc(name), ch);
      userEvent(c, name, roster(c, ch), "NAMES");
      emitOps(c, ch);
      return;
    }
    case "MODE":
      return mode(c, l);
    case "324":
      emit("irc_mode_event", { server_id: c.id, channel: l.params[1], modes: l.params.slice(2).join(" "), set_by: null, is_full_listing: true });
      return;
    case "INVITE":
      emit("irc_invited", { server_id: c.id, channel: l.params[1], inviter: l.nick });
      return;
    case "AWAY":
      emit("irc_away_event", { server_id: c.id, nick: l.nick, away: l.params.length > 0, reason: l.params[0] });
      return;
    case "305":
    case "306":
      emit("irc_away_event", { server_id: c.id, nick: c.nick, away: l.cmd === "306", reason: undefined });
      return;
    case "321":
      emit("irc_list_start", { server_id: c.id });
      return;
    case "322":
      emit("irc_list_item", { server_id: c.id, channel: l.params[1], users: Number(l.params[2]) || 0, topic: l.params[3] ?? "" });
      return;
    case "323":
      emit("irc_list_end", { server_id: c.id });
      return;
    case "475":
      emit("irc_bad_channel_key", { server_id: c.id, channel: l.params[1], error: l.params[2] ?? "Bad channel key" });
      return;
    case "473":
      emit("irc_invite_only", { server_id: c.id, channel: l.params[1], error: l.params[2] ?? "Invite only" });
      return;
    case "482":
      emit("irc_mode_error", { server_id: c.id, channel: l.params[1], error: l.params[2] ?? "Not channel operator" });
      return;
    default:
      // Remaining 4xx/5xx numerics are shown as server messages.
      if (/^[45]\d\d$/.test(l.cmd)) sys(c, isChan(l.params[1] ?? "") ? l.params[1] : "", l.params.slice(1).join(" "));
  }
}

function mode(c: Conn, l: IrcLine) {
  const [target, modes, ...args] = l.params;
  const ch = c.chans.get(lc(target));
  if (!isChan(target) || !modes) return;
  let add = true;
  let ai = 0;
  for (const m of modes) {
    if (m === "+" || m === "-") add = m === "+";
    else if (c.prefixes.some(([x]) => x === m)) {
      const member = ch?.members.get(lc(args[ai++] ?? ""));
      if (add) member?.modes.add(m);
      else member?.modes.delete(m);
    } else if ("kbeIlfjL".includes(m) && (add || "kbeI".includes(m))) ai++;
  }
  const text = l.params.slice(1).join(" ");
  emit("irc_mode_event", { server_id: c.id, channel: target, modes: text, set_by: l.nick, is_full_listing: false });
  sys(c, target, `${l.nick || "Server"} sets mode ${text}`);
  if (ch) {
    emitOps(c, ch);
    userEvent(c, ch.name, roster(c, ch), "NAMES");
  }
}

async function message(c: Conn, l: IrcLine, time?: string) {
  const target = l.params[0];
  const raw = l.params[1] ?? "";
  const notice = l.cmd === "NOTICE";
  const sender = l.nick || l.prefix;
  const self = lc(sender) === lc(c.nick);
  if (!self && l.user && ignoreMasks.some((r) => r.test(`${l.nick}!${l.user}@${l.host}`))) return;
  if (l.host) emit("irc_user_host_event", { server_id: c.id, nick: l.nick, host: l.user ? `${l.user}@${l.host}` : l.host, realname: null });
  if (!notice && raw === ctcp("VERSION")) return send(c, "NOTICE", [l.nick, ctcp("VERSION Luna IRC (web)")]);

  const body = (prefix: string) => (raw.startsWith(prefix) ? raw.slice(prefix.length).replace(/\x01$/, "") : null);
  const avatar = body("\x01LUNAAVATAR ");
  if (avatar != null) {
    if (!self) emit("irc_avatar", { serverId: c.id, sender, target, notice, body: avatar });
    return;
  }
  const hello = body("\x01LUNA HELLO");
  if (hello != null) {
    if (!self) emit("irc_luna_hello", { serverId: c.id, sender, target, notice, body: hello.trim() });
    return;
  }
  const react = notice ? null : body("\x01LUNAREACT ");
  if (react != null) {
    const [act, author, hash, extra] = react.trim().split(/\s+/);
    if (act && "+-".includes(act[0]) && act.length > 1 && author && hash && !extra) {
      emit("irc_reaction", { serverId: c.id, target: logTarget(target, sender, self), sender, author, hash, emoji: act.slice(1), add: act[0] === "+" });
    }
    return;
  }

  let content = raw;
  let timestamp = time;
  if (!timestamp && c.p.parseLegacyZncTimestamps) {
    const m = /^\[(\d{2}:\d{2}(?::\d{2})?)\]\s*/.exec(content);
    if (m) {
      content = content.slice(m[0].length);
      const d = new Date(`${localTimestamp().slice(0, 10)}T${m[1].length === 5 ? m[1] + ":00" : m[1]}`);
      if (!isNaN(+d)) timestamp = d.toISOString();
    }
  }
  const msgid = l.tags["msgid"] || null;
  const replyTo = l.tags["+draft/reply"] || l.tags["+reply"] || null;
  const isSystem = sender === "***" || content.includes("Buffer Playback") || content.includes("Playback Complete.") || notice;
  let logId: string | null = null;
  if (sender !== "***" && sender.trim() && target.trim()) {
    const when = timestamp ? new Date(timestamp) : new Date();
    logId = await appendLog({
      serverId: c.id, target: logTarget(target, sender, self), timestamp: localTimestamp(isNaN(+when) ? new Date() : when),
      sender, content, msgid: msgid ?? undefined, replyToMsgid: replyTo ?? undefined,
    }).catch(() => null);
  }
  emit("irc_message", { server_id: c.id, sender, content, channel: target, is_system: isSystem, timestamp: timestamp ?? null, msgid, reply_to_msgid: replyTo, reply_nick: null, reply_preview: null, log_id: logId });
  if (sender !== "***" && !sender.includes("*") && sender.trim() && isChan(target)) userEvent(c, target, [sender], "JOIN");
}

/** On-connect command list (same syntax as the desktop client), then the channel joins. */
async function startup(c: Conn) {
  const services: Record<string, string> = { ns: "NickServ", nickserv: "NickServ", cs: "ChanServ", chanserv: "ChanServ", hs: "HostServ", bs: "BotServ", ms: "MemoServ" };
  try {
    for (const line of c.p.onConnectCommands ?? []) {
      const s = line.trim().replace(/^\//, "");
      if (!s || s.startsWith(";")) continue;
      const cmd = s.split(/\s+/)[0];
      const arg = s.slice(cmd.length).trim();
      const lcmd = lc(cmd);
      if (lcmd === "wait" || lcmd === "sleep") await new Promise((r) => setTimeout(r, Math.min(30, Number(arg) || 0) * 1000));
      else if (services[lcmd]) send(c, "PRIVMSG", [services[lcmd], arg]);
      else if (["msg", "privmsg", "notice"].includes(lcmd)) {
        const [to] = arg.split(/\s+/);
        send(c, lcmd === "notice" ? "NOTICE" : "PRIVMSG", [to, arg.slice(to.length).trim()]);
      } else {
        const rawLine = lcmd === "raw" || lcmd === "quote" ? arg : s;
        const [head, trailing] = rawLine.split(" :");
        const words = head.trim().split(/\s+/);
        send(c, words[0].toUpperCase(), [...words.slice(1), ...(trailing != null ? [trailing] : [])]);
      }
    }
    for (const ch of c.p.channels ?? []) send(c, "JOIN", ch.password ? [ch.name, ch.password] : [ch.name]);
  } catch {
    /* connection dropped mid-startup */
  }
}

// ---- API used by the invoke table ----------------------------------------------------------------
export async function sendMessage(a: any) {
  const c = get(a.serverId);
  const tags = a.replyToMsgid && c.caps.has("message-tags") ? { "+draft/reply": a.replyToMsgid } : undefined;
  for (const line of String(a.message).split(/\r?\n/).filter(Boolean)) {
    for (let i = 0; i < line.length; i += 400) send(c, "PRIVMSG", [a.channel, line.slice(i, i + 400)], tags);
  }
  await appendLog({
    serverId: c.id, target: a.channel, timestamp: localTimestamp(), sender: c.nick, content: a.message, id: a.localId ?? undefined,
    replyToMsgid: a.replyToMsgid ?? undefined, replyNick: a.replyNick ?? undefined, replyPreview: a.replyPreview ?? undefined,
  });
}
export const raw = (id: string, cmd: string, params: string[], tags?: Record<string, string>) => send(get(id), cmd, params, tags);
export const hasCap = (id: string, cap: string) => conns.get(id)?.caps.has(cap) ?? false;
export const ctcpText = ctcp;
