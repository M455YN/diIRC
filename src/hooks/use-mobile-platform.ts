import { useEffect, useState } from "react";
import { type as osType } from "@tauri-apps/plugin-os";

export type MobileOs = "android" | "ios";

function detectOsFromUa(): MobileOs | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  return null;
}

function detectOs(): MobileOs | null {
  try {
    const t = osType();
    if (t === "android" || t === "ios") return t;
  } catch {
    // fall through
  }
  return detectOsFromUa();
}

function detectMobileShell(): boolean {
  if (detectOs()) return true;
  if (typeof window === "undefined") return false;
  // Coarse pointer + narrow width: phone/tablet WebView even if OS plugin fails
  const narrow = window.matchMedia("(max-width: 900px)").matches;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return narrow && coarse;
}

function applyDomFlags(isMobile: boolean, os: MobileOs | null) {
  document.documentElement.classList.toggle("mobile-shell", isMobile);
  if (isMobile) {
    document.documentElement.dataset.mobileOs = os ?? "android";
  } else {
    delete document.documentElement.dataset.mobileOs;
  }
}

/** True when running the dedicated mobile shell (Android / iOS, or narrow web fallback). */
export function useIsMobileShell(): boolean {
  const [isMobile, setIsMobile] = useState(() => detectMobileShell());

  useEffect(() => {
    const refresh = () => {
      const mobile = detectMobileShell();
      setIsMobile(mobile);
      applyDomFlags(mobile, detectOs());
    };

    refresh();

    const mqlNarrow = window.matchMedia("(max-width: 900px)");
    const mqlCoarse = window.matchMedia("(pointer: coarse)");
    mqlNarrow.addEventListener("change", refresh);
    mqlCoarse.addEventListener("change", refresh);
    return () => {
      mqlNarrow.removeEventListener("change", refresh);
      mqlCoarse.removeEventListener("change", refresh);
    };
  }, []);

  useEffect(() => {
    applyDomFlags(isMobile, detectOs());
  }, [isMobile]);

  return isMobile;
}

/** Current mobile OS, or null on desktop. */
export function useMobileOs(): MobileOs | null {
  const [os, setOs] = useState<MobileOs | null>(() => detectOs());

  useEffect(() => {
    setOs(detectOs());
  }, []);

  return os;
}

/** Sync helper for non-React code paths. */
export function isMobileShell(): boolean {
  return detectMobileShell();
}
