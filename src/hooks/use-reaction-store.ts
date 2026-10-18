import { create } from "zustand";
import { persist } from "zustand/middleware";

/** emoji -> nicks that reacted with it */
export type MessageReactions = Record<string, string[]>;

interface ReactionState {
  /** chat key -> message key -> reactions. Persisted locally only: reactions travel as CTCPs, never through the server log. */
  byChat: Record<string, Record<string, MessageReactions>>;
  /** Idempotent, so the echo of our own reaction changes nothing. */
  apply: (chatKey: string, messageKey: string, emoji: string, nick: string, add: boolean) => void;
}

export const useReactionStore = create<ReactionState>()(
  persist(
    (set) => ({
      byChat: {},
      apply: (chatKey, messageKey, emoji, nick, add) =>
        set((state) => {
          const chat = state.byChat[chatKey] ?? {};
          const message = chat[messageKey] ?? {};
          const who = new Set(message[emoji] ?? []);
          const had = who.has(nick);
          if (add === had) return state;
          if (add) who.add(nick);
          else who.delete(nick);

          const nextMessage = { ...message };
          if (who.size) nextMessage[emoji] = [...who];
          else delete nextMessage[emoji];

          const nextChat = { ...chat };
          if (Object.keys(nextMessage).length) nextChat[messageKey] = nextMessage;
          else delete nextChat[messageKey];

          return { byChat: { ...state.byChat, [chatKey]: nextChat } };
        }),
    }),
    // shortcut: reactions are never pruned, fine for chat-sized data; cap per chat if the store grows.
    { name: "diirc-reactions" }
  )
);
