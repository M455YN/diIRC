import { invoke } from "@tauri-apps/api/core";
import { getServerSelfMember, useMockStore } from "@/lib/mock-store";

// shortcut: long messages are cut so the forwarded line fits an IRC line, instead of being split in several.
const MAX_FORWARD_CHARS = 300;

/** Sends `text` to another channel as ourselves; returns false if the channel is gone or sending failed. */
export async function forwardToChannel(serverId: string, channelId: string, text: string): Promise<boolean> {
  const store = useMockStore.getState();
  const server = store.servers.find((s) => s.id === serverId);
  const channel = server?.channels.find((c) => c.id === channelId);
  if (!server || !channel) return false;
  const sender = getServerSelfMember(server, store.currentProfile.id);
  const target = channel.name.startsWith("#") ? channel.name : `#${channel.name}`;
  const line = text.length > MAX_FORWARD_CHARS ? `${text.slice(0, MAX_FORWARD_CHARS - 1)}…` : text;

  // Only the open chat is kept in memory; the echo of our own message is dropped, so show it ourselves.
  const created =
    store.activeChatKey === `channel:${channel.id}` ? store.addMessage(channel.id, sender, line, null, false) : null;
  try {
    await invoke("send_message", {
      serverId,
      channel: target,
      message: line.replace(/\r?\n/g, "\u0085"),
      replyToMsgid: null,
      replyNick: null,
      replyPreview: null,
      replyParentOffset: null,
      localId: created?.id ?? null,
      replyMode: null,
    });
    return true;
  } catch (error) {
    console.error("Failed to forward the message:", error);
    if (created) store.removeLastMessageFromChannel(channel.id, sender.id);
    return false;
  }
}
