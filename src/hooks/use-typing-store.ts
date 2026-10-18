import { create } from "zustand";

/** Somebody who sent `active` and nothing since is shown as typing for this long (IRCv3 recommends at least 6 s). */
const TYPING_TIMEOUT_MS = 6000;

interface TypingState {
  /** chat key (`serverId|target` lowercase) -> nicks currently typing there. Not persisted. */
  typing: Record<string, string[]>;
  set: (chatKey: string, nick: string, active: boolean) => void;
  /** Removes `nick` from every chat of a server (they left or changed nick). */
  clearNick: (serverId: string, nick: string) => void;
}

/** Same chat key on both ends: channel name or peer nick, lowercased. */
export const typingChatKey = (serverId: string, target: string) => `${serverId}|${target.toLowerCase()}`;

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const timerKey = (chatKey: string, nick: string) => `${chatKey}\u0000${nick.toLowerCase()}`;

export const useTypingStore = create<TypingState>()((set, get) => ({
  typing: {},
  set: (chatKey, nick, active) => {
    const key = timerKey(chatKey, nick);
    clearTimeout(timers.get(key));
    timers.delete(key);

    const current = get().typing[chatKey] ?? [];
    const has = current.some((n) => n.toLowerCase() === nick.toLowerCase());
    if (active) {
      timers.set(key, setTimeout(() => get().set(chatKey, nick, false), TYPING_TIMEOUT_MS));
      if (!has) set((state) => ({ typing: { ...state.typing, [chatKey]: [...current, nick] } }));
    } else if (has) {
      set((state) => ({
        typing: { ...state.typing, [chatKey]: current.filter((n) => n.toLowerCase() !== nick.toLowerCase()) },
      }));
    }
  },
  clearNick: (serverId, nick) => {
    for (const chatKey of Object.keys(get().typing)) {
      if (chatKey.startsWith(`${serverId}|`)) get().set(chatKey, nick, false);
    }
  },
}));
