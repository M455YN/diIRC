// `invoke` replacement: maps Tauri command names to the browser implementation.
import * as irc from "./irc-client";
import * as logs from "./log-db";

const none = async () => undefined;

const commands: Record<string, (a: any) => Promise<unknown> | unknown> = {
  connect_irc: (a) => irc.connect(a.params),
  disconnect_irc: (a) => irc.disconnect(a.serverId),
  send_message: (a) => irc.sendMessage(a),
  join_channel: (a) => irc.raw(a.serverId, "JOIN", a.password ? [a.channel, a.password] : [a.channel]),
  part_channel: (a) => irc.raw(a.serverId, "PART", [a.channel]),
  refresh_channel_names: (a) => irc.raw(a.serverId, "NAMES", [a.channel]),
  request_channel_list: (a) => irc.raw(a.serverId, "LIST", []),
  request_motd: (a) => irc.raw(a.serverId, "MOTD", []),
  set_channel_topic: (a) => irc.raw(a.serverId, "TOPIC", [a.channel, a.topic]),
  set_channel_key: (a) => irc.raw(a.serverId, "MODE", a.key ? [a.channel, "+k", a.key] : [a.channel, "-k", "*"]),
  send_mode: (a) => irc.raw(a.serverId, "MODE", [a.target, ...(a.mode ? [a.mode] : []), ...(a.params ?? [])]),
  send_invite: (a) => irc.raw(a.serverId, "INVITE", [a.nickname, a.channel]),
  send_away: (a) => irc.raw(a.serverId, "AWAY", a.reason ? [a.reason] : []),
  send_ctcp: (a) => {
    if (/^[#&+!]/.test(a.target)) throw "Luna CTCPs are never sent to a channel";
    irc.raw(a.serverId, a.notice ? "NOTICE" : "PRIVMSG", [a.target, irc.ctcpText(a.body)]);
  },
  send_luna_hello: (a) => {
    if (!irc.hasCap(a.serverId, "message-tags")) return false;
    irc.raw(a.serverId, "TAGMSG", [a.target], { "+lunairc/hello": a.value });
    return true;
  },
  send_typing: (a) => {
    if (irc.hasCap(a.serverId, "message-tags")) irc.raw(a.serverId, "TAGMSG", [a.target], { "+typing": a.typingState });
  },
  set_ignore_list: (a) => irc.setIgnoreList(a.patterns),
  set_quit_message: (a) => irc.setQuitMessage(a.message),
  get_message_caps: async () => ({ edit: false, redact: false }),
  edit_message: async () => { throw "Editing messages is not supported in the web client"; },
  redact_message: async () => { throw "Deleting messages is not supported in the web client"; },

  load_log_tail: (a) => logs.loadTail(a.serverId, a.channel),
  load_log_page: (a) => logs.loadPage(a.serverId, a.channel, a.before, a.after),
  find_log_message_by_msgid: (a) => logs.findByMsgid(a.serverId, a.channel, a.msgid),
  search_log: (a) => logs.searchLog(a.serverId, a.channel, a.criteria),
  list_logged_conversations: (a) => logs.listConversations(a.serverId),
  delete_last_log_entry: (a) => logs.deleteLast(a.serverId, a.target, a.sender),

  get_raw_log: async () => [],
  clear_raw_log: none,
  fetch_image_proxy: async (a) => a.url, // no server-side proxy in the browser: let <img> load the URL directly
  send_os_notification: async (a) => {
    if ("Notification" in window && Notification.permission === "granted") new Notification(a.title, { body: a.body, tag: a.tag ?? undefined });
  },
  check_app_update: async () => null,
};
// Desktop-only commands fall through to a no-op.
export async function invoke<T = unknown>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  if (cmd.startsWith("plugin:")) return undefined as T;
  const fn = commands[cmd];
  if (!fn) return undefined as T; // link_preview_*, set_window_material, toggle_devtools, create_app_backup, ...
  return (await fn(args)) as T;
}
