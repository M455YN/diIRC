import { invoke } from "@tauri-apps/api/core";
import { stripSteganography } from "@/lib/markdown/multiline-steganography";
import { useReactionStore } from "@/hooks/use-reaction-store";
import { hasLunaPeerFor, isPeersEnabled } from "@/lib/luna-peers";

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

/** Adds or removes our reaction locally and tells the other Luna clients in the chat. */
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
  // With the handshake on, a reaction nobody in the chat could display stays local instead of reaching other clients.
  if (isPeersEnabled() && !hasLunaPeerFor(serverId, target)) return;
  const hash = messageKey.slice(messageKey.lastIndexOf("|") + 1);
  try {
    await invoke("send_ctcp", {
      serverId,
      target,
      body: `LUNAREACT ${add ? "+" : "-"}${emoji} ${author} ${hash}`,
    });
  } catch (error) {
    console.warn("Failed to send the reaction:", error);
  }
}
