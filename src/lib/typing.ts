import { invoke } from "@tauri-apps/api/core";
import { useMockStore } from "@/lib/mock-store";

/** How often `active` is repeated while someone keeps typing (receivers drop it after about 6 s). */
const REPEAT_MS = 3000;

let current: { serverId: string; target: string; at: number } | null = null;

const send = (serverId: string, target: string, typingState: "active" | "done") =>
  invoke("send_typing", { serverId, target, typingState }).catch(() => undefined);

/** We stopped typing (cleared the box, sent the message or left the chat): tell the chat once. */
export function stopTyping() {
  if (!current) return;
  const { serverId, target } = current;
  current = null;
  void send(serverId, target, "done");
}

/**
 * Call whenever the message box text or target changes. Sends `active` at most every 3 s while there
 * is text (commands do not count) and `done` once when it is gone.
 */
export function notifyTyping(serverId: string, target: string, text: string) {
  const typing = useMockStore.getState().sendTypingNotifications && text.trim() !== "" && !text.trimStart().startsWith("/");
  if (!typing) return stopTyping();
  if (current && (current.serverId !== serverId || current.target !== target)) stopTyping();
  if (current && Date.now() - current.at < REPEAT_MS) return;
  current = { serverId, target, at: Date.now() };
  void send(serverId, target, "active");
}
