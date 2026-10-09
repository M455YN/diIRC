import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useTheme } from "next-themes";

export type MobileThemeMode = "system" | "light" | "dark";

interface MobileThemeState {
  mode: MobileThemeMode;
  pureBlack: boolean;
  setMode: (mode: MobileThemeMode) => void;
  setPureBlack: (enabled: boolean) => void;
}

export const useMobileThemeStore = create<MobileThemeState>()(
  persist(
    (set) => ({
      mode: "system",
      pureBlack: true,
      setMode: (mode) => set({ mode }),
      setPureBlack: (pureBlack) => set({ pureBlack }),
    }),
    { name: "diirc-mobile-theme" }
  )
);

function useSystemPrefersDark(): boolean {
  const [dark, setDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches
  );
  useEffect(() => {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setDark(mql.matches);
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, []);
  return dark;
}

/**
 * Drives the next-themes class on the mobile shell from the phone's light/dark setting
 * (or a manual override), with an optional pure black (OLED) dark variant.
 */
export function useMobileThemeSync() {
  const { setTheme } = useTheme();
  const mode = useMobileThemeStore((s) => s.mode);
  const pureBlack = useMobileThemeStore((s) => s.pureBlack);
  const systemDark = useSystemPrefersDark();

  const isDark = mode === "dark" || (mode === "system" && systemDark);
  const resolved = isDark ? (pureBlack ? "oled" : "dark") : "light";

  useEffect(() => {
    setTheme(resolved);
  }, [resolved, setTheme]);
}
