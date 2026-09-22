import { invoke } from "@tauri-apps/api/core";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useMockStore } from "@/lib/mock-store";

export interface UpdateProgress {
  status: "idle" | "checking" | "backing_up" | "downloading" | "installing" | "ready" | "error";
  downloadedBytes: number;
  totalBytes: number;
  percentage: number;
  errorMessage?: string;
  isDebFallback?: boolean;
}

export const GITHUB_RELEASES_URL = "https://github.com/TheStami/diIRC/releases/latest";
export const DEFAULT_UPDATE_ENDPOINT = "https://irc-update.a15-5fc.workers.dev/";

/** Check if running inside Tauri context */
export const isTauriEnvironment = (): boolean => {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
};

/** In-app updater is desktop-only (unsupported on iOS/Android). */
export const isDesktopUpdateSupported = (): boolean => {
  if (!isTauriEnvironment() || typeof navigator === "undefined") {
    return false;
  }
  const ua = navigator.userAgent.toLowerCase();
  return !/iphone|ipad|ipod|android/.test(ua);
};

/** Get currently configured update endpoint based on user settings */
export const getActiveUpdateEndpoint = (): string | undefined => {
  const { updateSourceMode, customUpdateUrl } = useMockStore.getState();
  if (updateSourceMode === "custom" && customUpdateUrl?.trim()) {
    return customUpdateUrl.trim();
  }
  return undefined;
};

/** Perform update check */
export const checkForAppUpdate = async (overrideEndpoint?: string): Promise<Update | null> => {
  if (!isDesktopUpdateSupported()) {
    console.warn("Update check skipped: Not running in Tauri desktop environment.");
    return null;
  }
  try {
    const endpoint = overrideEndpoint ?? getActiveUpdateEndpoint();
    const metadata = await invoke<any>("check_app_update", { endpoint: endpoint || null });
    if (!metadata) {
      return null;
    }
    return new Update(metadata);
  } catch (error) {
    console.error("Error checking for updates:", error);
    throw error;
  }
};

/** Download and install update with progress callback */
export const installAppUpdate = async (
  update: Update,
  onProgress?: (progress: UpdateProgress) => void
): Promise<void> => {
  let downloadedBytes = 0;
  let totalBytes = 0;

  try {
    // 1. Create a full app data backup before starting update
    onProgress?.({
      status: "backing_up",
      downloadedBytes: 0,
      totalBytes: 0,
      percentage: 0,
    });

    try {
      const backupPath = await invoke<string>("create_app_backup");
      console.log("App backup successfully created at:", backupPath);
    } catch (backupErr) {
      console.error("Warning: Failed to create app backup before update:", backupErr);
    }

    // 2. Download and install update
    onProgress?.({
      status: "downloading",
      downloadedBytes: 0,
      totalBytes: 0,
      percentage: 0,
    });

    await update.downloadAndInstall((event) => {
      if (event.event === "Started") {
        totalBytes = event.data.contentLength || 0;
        onProgress?.({
          status: "downloading",
          downloadedBytes: 0,
          totalBytes,
          percentage: 0,
        });
      } else if (event.event === "Progress") {
        downloadedBytes += event.data.chunkLength;
        const percentage = totalBytes > 0 ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100)) : 0;
        onProgress?.({
          status: "downloading",
          downloadedBytes,
          totalBytes,
          percentage,
        });
      } else if (event.event === "Finished") {
        onProgress?.({
          status: "installing",
          downloadedBytes,
          totalBytes: downloadedBytes,
          percentage: 100,
        });
      }
    });

    onProgress?.({
      status: "ready",
      downloadedBytes,
      totalBytes: downloadedBytes,
      percentage: 100,
    });

    // Relaunch app to apply update
    await relaunch();
  } catch (error: any) {
    const errStr = String(error?.message || error || "");
    console.error("Failed to install update:", error);
    
    // Check if error is specifically related to Debian / Linux system package manager (.deb)
    const isLinuxPlatform = typeof navigator !== "undefined" && /linux/i.test(navigator.userAgent);
    const isDebOrPermissionError = 
      isLinuxPlatform && (
        errStr.includes("Permission denied") || 
        errStr.includes("dpkg") || 
        errStr.includes("usr") || 
        errStr.includes("read-only") || 
        errStr.includes("operation not permitted") ||
        errStr.includes("deb")
      );

    onProgress?.({
      status: "error",
      downloadedBytes: 0,
      totalBytes: 0,
      percentage: 0,
      errorMessage: errStr || "Failed to download or install update.",
      isDebFallback: isDebOrPermissionError,
    });
    throw error;
  }
};

/** Open GitHub releases page in external browser */
export const openGitHubReleases = async (): Promise<void> => {
  try {
    await openUrl(GITHUB_RELEASES_URL);
  } catch {
    window.open(GITHUB_RELEASES_URL, "_blank");
  }
};
