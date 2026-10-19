import { stripSteganography } from "@/lib/markdown/multiline-steganography";
import { useReactionStore } from "@/hooks/use-reaction-store";
import { lunaPeersFor } from "@/lib/luna-peers";
import { sendLunaCtcp } from "@/lib/luna-ctcp";

export const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🎉"];

/** Same chat key on both ends: channel name or peer nick, lowercased. */
export const reactionChatKey = (serverId: string, target: string) => `${serverId}|${target.toLowerCase()}`;

/**
 * Identifies a message across clients without server msgids: author plus a hash of its text.
 * shortcut: the same author repeating identical text shares reactions; add a hidden id if that matters.
 */
export function reactionMessageKey(author: string, content: string): string {
  const text = stripSteganography(content).replace(/\u0085/g, "\n").trim();
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${author.toLowerCase()}|${hash.toString(16)}`;
}

/**
 * Adds or removes our reaction locally and tells the other Luna clients in the chat, each one privately:
 * nothing is sent to the channel, so other clients and older Lunas never see it. A reaction nobody could
 * display stays local.
 */
export async function sendReaction(opts: {
  serverId: string;
  target: string;
  ownNick: string;
  author: string;
  content: string;
  emoji: string;
  add: boolean;
}): Promise<void> {
  const { serverId, target, ownNick, author, content, emoji, add } = opts;
  const messageKey = reactionMessageKey(author, content);
  useReactionStore.getState().apply(reactionChatKey(serverId, target), messageKey, emoji, ownNick, add);
  const hash = messageKey.slice(messageKey.lastIndexOf("|") + 1);
  // In a channel the reaction names it (the receiver gets it as a private message from us).
  const channel = /^[#&]/.test(target) ? ` ${target}` : "";
  const body = `LUNAREACT ${add ? "+" : "-"}${emoji} ${author} ${hash}${channel}`;
  for (const nick of lunaPeersFor(serverId, target)) sendLunaCtcp(serverId, nick, body, false, true);
}
