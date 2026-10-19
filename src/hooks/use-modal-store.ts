import { Channel, ChannelType, Server } from "@/types";
import type { ExtensionDialogData } from "@/lib/extensions/types";
import { create } from "zustand";

export type ModalType = 
  | "createServer" 
  | "invite" 
  | "editServer" 
  | "members" 
  | "createChannel" 
  | "leaveServer" 
  | "deleteServer" 
  | "deleteChannel" 
  | "settings"
  | "imagePreview"
  | "ircError"
  | "editTopic"
  | "joinChannelPassword"
  | "setChannelPassword"
  | "channelSettings"
  | "channelOperatorSettings"
  | "connectionDetails"
  | "roleIcons"
  | "privateMessages"
  | "updateAvailable"
  | "motd"
  | "alreadyAway"
  | "changelog"
  | "bookmarks"
  | "notes"
  | "channelList"
  | "forwardMessage"
  | "rawLog"
  | "whois"
  | "extensionDialog"
  | "luna"
  | "externalLink"
  | "linkPreview";

interface ModalData {
  server?: Server;
  channel?: Channel;
  serverId?: string;
  channelName?: string;
  /** Nick the whois modal asks about. */
  nick?: string;
  /** A dialog an extension asked for (extensionDialog modal). */
  extDialog?: ExtensionDialogData;
  conversationId?: string;
  /** Text of the message being forwarded (forwardMessage modal). */
  forward?: string;
  key?: string;
  channelType?: ChannelType;
  apiUrl?: string;
  query?: Record<string, string | number | boolean | undefined>;
  url?: string;
  title?: string;
  description?: string;
  errorMessage?: string;
  flag?: string;
  motd?: string[];
  updateInfo?: {
    currentVersion: string;
    version: string;
    body?: string;
    date?: string;
    onUpdate?: () => Promise<void>;
  };
}

interface ModalStore {
  type: ModalType | null;
  data: ModalData;
  isOpen: boolean;
  errorData: ModalData | null;
  onOpen: (type: ModalType, data?: ModalData) => void;
  onClose: (closingType?: ModalType | unknown) => void;
}

export const useModal = create<ModalStore>((set) => ({
  type: null,
  data: {},
  isOpen: false,
  errorData: null,
  onOpen: (type, data = {}) => {
    if (type === "ircError") {
      set({ errorData: data });
    } else {
      set({ isOpen: true, type, data });
    }
  },
  onClose: (closingType?: ModalType | unknown) =>
    set((state) => {
      if (closingType === "ircError") {
        return { errorData: null };
      }
      if (typeof closingType === "string" && state.type && state.type !== closingType) {
        return state;
      }
      return { type: null, isOpen: false, data: {}, errorData: null };
    }),
}));

export const useModalStore = useModal;

