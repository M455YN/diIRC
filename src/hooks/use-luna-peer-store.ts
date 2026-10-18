import { create } from "zustand";

export interface LunaPeer {
  version: string;
  features: string[];
}

interface LunaPeerState {
  /** Users known to run Luna, keyed `serverId|nick(lowercase)`. Session only: it is rebuilt by the handshake. */
  peers: Record<string, LunaPeer>;
  setPeer: (key: string, peer: LunaPeer) => void;
}

export const useLunaPeerStore = create<LunaPeerState>()((set) => ({
  peers: {},
  setPeer: (key, peer) =>
    set((state) => {
      const old = state.peers[key];
      if (old && old.version === peer.version && old.features.join() === peer.features.join()) return state;
      return { peers: { ...state.peers, [key]: peer } };
    }),
}));
