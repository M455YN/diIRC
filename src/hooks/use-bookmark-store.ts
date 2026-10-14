import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface MessageBookmark {
  messageId: string;
  serverId: string;
  /** Route the message was bookmarked from; the bookmarks list navigates back to it. */
  path: string;
  chatLabel: string;
  nick: string;
  content: string;
  timestamp: string;
  createdAt: number;
}

interface BookmarkStore {
  bookmarks: MessageBookmark[];
  toggle: (bookmark: MessageBookmark) => void;
  remove: (messageId: string) => void;
}

export const useBookmarkStore = create<BookmarkStore>()(
  persist(
    (set) => ({
      bookmarks: [],
      toggle: (bookmark) =>
        set((state) => ({
          bookmarks: state.bookmarks.some((b) => b.messageId === bookmark.messageId)
            ? state.bookmarks.filter((b) => b.messageId !== bookmark.messageId)
            : [bookmark, ...state.bookmarks],
        })),
      remove: (messageId) =>
        set((state) => ({ bookmarks: state.bookmarks.filter((b) => b.messageId !== messageId) })),
    }),
    { name: "message-bookmarks" }
  )
);
