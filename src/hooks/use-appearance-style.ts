import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { useTheme } from "next-themes";
import { invoke } from "@tauri-apps/api/core";

/**
 * Visual style is an axis independent from the colour mode (light / dark / oled, owned by next-themes).
 * It is exposed on <html> as `data-style` so CSS can restyle surfaces for any colour mode.
 */
export type AppearanceStyle = "standard" | "fluent";

/**
 * How a message row is laid out: Discord-style (avatar, name above text, grouped runs) or
 * classic IRC (one dense `[time] <nick> text` line per message, no avatars).
 */
export type MessageLayout = "discord" | "irc";

/** Windows 11 backdrop material behind the translucent Fluent surfaces. */
export type WindowMaterial = "mica" | "acrylic" | "none";

interface AppearanceStyleState {
  style: AppearanceStyle;
  material: WindowMaterial;
  layout: MessageLayout;
  setStyle: (style: AppearanceStyle) => void;
  setMaterial: (material: WindowMaterial) => void;
  setLayout: (layout: MessageLayout) => void;
}

export const useAppearanceStyleStore = create<AppearanceStyleState>()(
  persist(
    (set) => ({
      style: "standard",
      material: "mica",
      layout: "discord",
      setStyle: (style) => set({ style }),
      setMaterial: (material) => set({ material }),
      setLayout: (layout) => set({ layout }),
    }),
    { name: "diirc-appearance-style" }
  )
);

let windows11Probe: Promise<boolean> | null = null;

/** Windows 10 and 11 share "Windows NT 10.0"; UA-CH platformVersion >= 13 is Windows 11. */
function detectWindows11(): Promise<boolean> {
  windows11Probe ??= (async () => {
    const uaData = (navigator as any).userAgentData;
    if (uaData?.platform !== "Windows" || !uaData.getHighEntropyValues) return false;
    try {
      const { platformVersion } = await uaData.getHighEntropyValues(["platformVersion"]);
      return parseInt(String(platformVersion).split(".")[0], 10) >= 13;
    } catch {
      return false;
    }
  })();
  return windows11Probe;
}

/** Fluent is only offered (and applied) on Windows 11 or newer; false until detected. */
export function useIsWindows11(): boolean {
  const [isWin11, setIsWin11] = useState(false);
  useEffect(() => {
    let alive = true;
    detectWindows11().then((v) => alive && setIsWin11(v));
    return () => {
      alive = false;
    };
  }, []);
  return isWin11;
}

const isTauri = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/**
 * Mirrors the style onto <html data-style> and drives the native window material.
 * `data-material` is only set once the native call succeeded, so on Windows 10, Linux or in
 * a plain browser the CSS keeps opaque surfaces instead of showing a see-through window.
 */
export function useAppearanceStyleSync() {
  const storedStyle = useAppearanceStyleStore((s) => s.style);
  const material = useAppearanceStyleStore((s) => s.material);
  const isWin11 = useIsWindows11();
  // A persisted "fluent" is ignored on anything older than Windows 11.
  const style: AppearanceStyle = storedStyle === "fluent" && isWin11 ? "fluent" : "standard";
  const { resolvedTheme } = useTheme();
  const nativeApplied = useRef(false);

  useEffect(() => {
    const root = document.documentElement;
    if (style === "standard") {
      root.removeAttribute("data-style");
    } else {
      root.setAttribute("data-style", style);
    }
  }, [style]);

  useEffect(() => {
    const root = document.documentElement;
    const wanted: WindowMaterial = style === "fluent" ? material : "none";
    let cancelled = false;

    if (wanted === "none") {
      root.removeAttribute("data-material");
      if (nativeApplied.current && isTauri()) {
        nativeApplied.current = false;
        invoke("set_window_material", { material: "none", dark: null }).catch(() => {});
      }
      return;
    }

    if (!isTauri()) {
      root.removeAttribute("data-material");
      return;
    }

    // Mica / Acrylic follow the OS theme unless told otherwise; use the app's resolved theme.
    const dark = resolvedTheme !== "light";
    invoke("set_window_material", { material: wanted, dark })
      .then(() => {
        if (cancelled) return;
        nativeApplied.current = true;
        root.setAttribute("data-material", wanted);
      })
      .catch((err) => {
        if (cancelled) return;
        console.warn("Window material unavailable:", err);
        root.removeAttribute("data-material");
      });

    return () => {
      cancelled = true;
    };
  }, [style, material, resolvedTheme]);
}
