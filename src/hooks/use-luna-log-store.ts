import { create } from "zustand";

export interface LunaLogEntry {
  id: number;
  /** Milliseconds since the epoch. */
  time: number;
  serverId: string;
  /** `tx` = sent by us, `rx` = received from another Luna. */
  dir: "tx" | "rx";
  text: string;
}

interface LunaLogState {
  entries: LunaLogEntry[];
  add: (entry: Omit<LunaLogEntry, "id" | "time">) => void;
  clear: () => void;
}

const MAX_ENTRIES = 500;
let counter = 0;

/** What Luna clients said to each other this session (handshake, avatars, reactions). Not persisted. */
export const useLunaLogStore = create<LunaLogState>()((set) => ({
  entries: [],
  add: (entry) =>
    set((state) => ({ entries: [...state.entries, { ...entry, id: ++counter, time: Date.now() }].slice(-MAX_ENTRIES) })),
  clear: () => set({ entries: [] }),
}));

export const logLuna = (serverId: string, dir: LunaLogEntry["dir"], text: string) =>
  useLunaLogStore.getState().add({ serverId, dir, text });
