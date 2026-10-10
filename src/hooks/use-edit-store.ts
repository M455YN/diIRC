import { create } from "zustand";

export interface EditTarget {
  /** Local id of the message being edited. */
  messageId: string;
  /** IRCv3 msgid of the original message. */
  msgid: string;
  /** Original text, shown in the banner. */
  original: string;
}

interface EditStore {
  pendingByChatId: Record<string, EditTarget>;
  setPending: (chatId: string, target: EditTarget) => void;
  clearPending: (chatId: string) => void;
}

export const useEditStore = create<EditStore>((set) => ({
  pendingByChatId: {},
  setPending: (chatId, target) =>
    set((state) => ({ pendingByChatId: { ...state.pendingByChatId, [chatId]: target } })),
  clearPending: (chatId) =>
    set((state) => {
      if (!(chatId in state.pendingByChatId)) return state;
      const { [chatId]: _removed, ...rest } = state.pendingByChatId;
      return { pendingByChatId: rest };
    }),
}));
