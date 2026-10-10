import { useEffect } from "react";
import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";

interface MessageCaps {
  /** Server negotiated `draft/message-edit` + `message-tags` and allows `+draft/edit`. */
  edit: boolean;
  /** Server negotiated `draft/message-redaction` (REDACT). */
  redact: boolean;
}

interface MessageCapsStore {
  byServer: Record<string, MessageCaps>;
  setCaps: (serverId: string, caps: MessageCaps) => void;
}

const NO_CAPS: MessageCaps = { edit: false, redact: false };

export const useMessageCapsStore = create<MessageCapsStore>((set) => ({
  byServer: {},
  setCaps: (serverId, caps) =>
    set((state) => ({ byServer: { ...state.byServer, [serverId]: caps } })),
}));

const inflight = new Set<string>();

/** Asks the backend for the server's negotiated flags (covers a missed `irc_caps` event). */
const fetchCaps = (serverId: string) => {
  if (inflight.has(serverId)) return;
  inflight.add(serverId);
  invoke<MessageCaps>("get_message_caps", { serverId })
    .then((caps) => useMessageCapsStore.getState().setCaps(serverId, caps))
    .catch(() => {})
    .finally(() => inflight.delete(serverId));
};

export const useMessageCaps = (serverId?: string | null): MessageCaps => {
  const known = useMessageCapsStore((state) => (serverId ? state.byServer[serverId] : undefined));
  useEffect(() => {
    if (serverId && !known) fetchCaps(serverId);
  }, [serverId, known]);
  return known ?? NO_CAPS;
};
