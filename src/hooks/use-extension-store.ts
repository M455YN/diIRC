import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ExtensionManifest, SettingValue } from "@/lib/extensions/types";

/** What the user decided about one extension; the code itself lives in the app data directory. */
export interface ExtensionState {
  enabled: boolean;
  /** Hosts from the manifest the user approved at install time. */
  network: string[];
  settings: Record<string, SettingValue>;
  /** Certificates the user chose to trust, by `host[:port]` -> SHA-256 of the certificate. */
  pins: Record<string, string>;
}

interface ExtensionStore {
  extensions: Record<string, ExtensionState>;
  /** Extensions found on disk (not persisted). */
  installed: ExtensionManifest[];
  setInstalled: (installed: ExtensionManifest[]) => void;
  /** Records the approval given at install time and turns the extension on. */
  approve: (id: string, network: string[]) => void;
  setEnabled: (id: string, enabled: boolean) => void;
  setSetting: (id: string, key: string, value: SettingValue) => void;
  pinCertificate: (id: string, host: string, sha256: string) => void;
  forgetCertificate: (id: string, host: string) => void;
  forget: (id: string) => void;
}

const blank: ExtensionState = { enabled: false, network: [], settings: {}, pins: {} };

const update = (state: ExtensionStore, id: string, change: Partial<ExtensionState>) => ({
  extensions: { ...state.extensions, [id]: { ...blank, ...state.extensions[id], ...change } },
});

export const useExtensionStore = create<ExtensionStore>()(
  persist(
    (set) => ({
      extensions: {},
      installed: [],
      setInstalled: (installed) => set({ installed }),
      approve: (id, network) => set((state) => update(state, id, { enabled: true, network })),
      setEnabled: (id, enabled) => set((state) => update(state, id, { enabled })),
      setSetting: (id, key, value) =>
        set((state) => update(state, id, { settings: { ...state.extensions[id]?.settings, [key]: value } })),
      pinCertificate: (id, host, sha256) =>
        set((state) => update(state, id, { pins: { ...state.extensions[id]?.pins, [host]: sha256 } })),
      forgetCertificate: (id, host) =>
        set((state) => {
          const { [host]: _removed, ...pins } = state.extensions[id]?.pins ?? {};
          return update(state, id, { pins });
        }),
      forget: (id) =>
        set((state) => {
          const { [id]: _removed, ...rest } = state.extensions;
          return { extensions: rest };
        }),
    }),
    { name: "luna-extensions", partialize: (state) => ({ extensions: state.extensions }) }
  )
);

/** Values of an extension's settings: the user's choice, else the default from its manifest. */
export function settingsOf(manifest: ExtensionManifest): Record<string, SettingValue> {
  const stored = useExtensionStore.getState().extensions[manifest.id]?.settings ?? {};
  const values: Record<string, SettingValue> = {};
  for (const setting of manifest.settings) {
    values[setting.key] = stored[setting.key] ?? setting.default ?? (setting.type === "boolean" ? false : "");
  }
  return values;
}
