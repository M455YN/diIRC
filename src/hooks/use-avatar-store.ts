import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface StoredAvatar {
  /** 8 hex chars, FNV-1a of `dataUrl` */
  hash: string;
  /** Small (32x32) `data:image/...;base64,...` image */
  dataUrl: string;
}

interface AvatarState {
  /** Our own avatar per server id. */
  own: Record<string, StoredAvatar>;
  /** Avatars of other users, keyed `serverId|nick(lowercase)`. */
  others: Record<string, StoredAvatar>;
  setOwn: (serverId: string, avatar: StoredAvatar | null) => void;
  setOther: (key: string, avatar: StoredAvatar | null) => void;
}

/**
 * Avatars live only in this client's local storage (the webview profile in the app's local data
 * folder): they reach other users as CTCP chunks and are never uploaded anywhere.
 */
export const useAvatarStore = create<AvatarState>()(
  persist(
    (set) => ({
      own: {},
      others: {},
      setOwn: (serverId, avatar) =>
        set((state) => {
          const own = { ...state.own };
          if (avatar) own[serverId] = avatar;
          else delete own[serverId];
          return { own };
        }),
      setOther: (key, avatar) =>
        set((state) => {
          const others = { ...state.others };
          if (avatar) others[key] = avatar;
          else delete others[key];
          return { others };
        }),
    }),
    // shortcut: avatars of everyone ever seen are kept (about 1.5 KB each); prune old ones if it grows.
    { name: "diirc-avatars" }
  )
);
