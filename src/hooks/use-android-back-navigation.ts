import { useEffect, useRef } from "react";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { onBackButtonPress, exit } from "@tauri-apps/api/app";
import { useModalStore } from "@/hooks/use-modal-store";
import { useIsMobileShell } from "@/hooks/use-mobile-platform";

export const MOBILE_BACK_EVENT = "diirc:mobile-back";

/** Dispatch a cancelable back event. Return true if a listener handled it. */
export function emitMobileBack(): boolean {
  const event = new CustomEvent(MOBILE_BACK_EVENT, { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

/**
 * Android gesture/hardware back → in-app navigation instead of leaving the app.
 * Listeners can call `event.preventDefault()` on `diirc:mobile-back` to consume back
 * (e.g. close a sheet).
 */
export function useAndroidBackNavigation(options?: {
  tab?: "servers" | "chats" | "more";
  setTab?: (tab: "servers" | "chats" | "more") => void;
}) {
  const isMobile = useIsMobileShell();
  const navigate = useNavigate();
  const location = useLocation();
  const { serverId } = useParams();
  const tab = options?.tab;
  const setTab = options?.setTab;

  const stateRef = useRef({
    pathname: location.pathname,
    serverId,
    tab,
    setTab,
    navigate,
  });
  stateRef.current = {
    pathname: location.pathname,
    serverId,
    tab,
    setTab,
    navigate,
  };

  useEffect(() => {
    if (!isMobile) return;

    let unlisten: (() => void) | undefined;
    let cancelled = false;

    const handleBack = () => {
      const modal = useModalStore.getState();
      if (modal.isOpen) {
        modal.onClose();
        return;
      }

      if (emitMobileBack()) return;

      const { pathname, serverId: sid, tab: currentTab, setTab: setCurrentTab, navigate: nav } =
        stateRef.current;
      const inChat = /\/(channels|conversations)\//.test(pathname);

      if (inChat && sid) {
        nav(`/servers/${sid}`);
        setCurrentTab?.("chats");
        return;
      }

      if (currentTab === "more") {
        setCurrentTab?.("chats");
        return;
      }
      if (currentTab === "chats") {
        setCurrentTab?.("servers");
        return;
      }

      void exit(0).catch(() => {});
    };

    onBackButtonPress(() => {
      handleBack();
    })
      .then((listener) => {
        if (cancelled) {
          void listener.unregister();
          return;
        }
        unlisten = () => {
          void listener.unregister();
        };
      })
      .catch((err) => {
        console.warn("Android back handler unavailable:", err);
      });

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [isMobile]);
}
