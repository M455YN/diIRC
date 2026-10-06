import { useEffect } from "react";
import { MOBILE_BACK_EVENT } from "@/hooks/use-android-back-navigation";

/**
 * Register a handler for Android back while a mobile overlay (sheet) is open.
 * Call `onBack` and preventDefault so the shell does not navigate away.
 */
export function useMobileBackHandler(active: boolean, onBack: () => void) {
  useEffect(() => {
    if (!active) return;

    const handler = (event: Event) => {
      event.preventDefault();
      onBack();
    };

    window.addEventListener(MOBILE_BACK_EVENT, handler);
    return () => window.removeEventListener(MOBILE_BACK_EVENT, handler);
  }, [active, onBack]);
}
