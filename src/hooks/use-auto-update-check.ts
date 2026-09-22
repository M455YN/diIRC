import { useEffect, useRef } from "react";
import { useMockStore } from "@/lib/mock-store";
import { useModal } from "@/hooks/use-modal-store";
import { checkForAppUpdate, isDesktopUpdateSupported } from "@/lib/update-service";
import tauriConfig from "../../src-tauri/tauri.conf.json";

export const useAutoUpdateCheck = () => {
  const autoUpdateMode = useMockStore((state) => state.autoUpdateMode);
  const onOpen = useModal((state) => state.onOpen);
  const hasCheckedOnStartup = useRef(false);

  useEffect(() => {
    if (hasCheckedOnStartup.current) return;
    hasCheckedOnStartup.current = true;

    if (!isDesktopUpdateSupported()) return;
    if (autoUpdateMode === "disabled") return;

    const runStartupCheck = async () => {
      try {
        const update = await checkForAppUpdate();
        if (update && update.available) {
          const currentVersion = tauriConfig.version || "0.1.7";
          onOpen("updateAvailable", {
            updateInfo: {
              currentVersion,
              version: update.version,
              body: update.body,
              date: update.date,
            },
            updateRef: update,
          } as any);
        }
      } catch (err) {
        console.warn("Startup update check failed or skipped:", err);
      }
    };

    // Small delay on app launch so UI loads smoothly first
    const timer = setTimeout(() => {
      runStartupCheck();
    }, 2500);

    return () => clearTimeout(timer);
  }, [autoUpdateMode, onOpen]);
};
