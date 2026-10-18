import { openUrl } from "@tauri-apps/plugin-opener";
import { useMockStore } from "@/lib/mock-store";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

/**
 * Opens a URL in the OS default system browser via Tauri plugin-opener,
 * falling back to window.open if running in standard web browser.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;
  try {
    await openUrl(url);
  } catch (err) {
    console.warn("Tauri plugin-opener failed, using fallback:", err);
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

/**
 * Opens a link clicked in the chat: in the in-app preview window when that is enabled (desktop),
 * otherwise in the system browser. Images that failed to load ("image") have their own toggle.
 */
/** Lowercase host of an http(s) URL, or null. */
export function linkHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    return /^https?:$/.test(parsed.protocol) ? parsed.hostname.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Raw IP addresses and punycode (look-alike) hosts deserve a second look. */
export function linkLooksSuspicious(url: string): boolean {
  const host = linkHost(url);
  return !!host && (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes("xn--") || /^\[.*\]$/.test(host));
}

export async function openLink(url: string, kind: "link" | "image" = "link", skipWarning = false): Promise<void> {
  if (!url) return;
  if (!skipWarning && kind === "link") {
    const { warnExternalLinks, trustedLinkHosts } = useMockStore.getState();
    const host = linkHost(url);
    if (warnExternalLinks && host && !trustedLinkHosts.includes(host)) {
      const { useModalStore } = await import("@/hooks/use-modal-store");
      useModalStore.getState().onOpen("externalLink", { url });
      return;
    }
  }
  if (/^ircs?:\/\//i.test(url)) {
    const { openIrcUrl } = await import("@/lib/irc-url");
    await openIrcUrl(url);
    return;
  }
  const { openLinksInPreview, openBlockedImagesInPreview } = useMockStore.getState();
  const previewEnabled =
    kind === "image" ? (openBlockedImagesInPreview ?? true) : (openLinksInPreview ?? false);
  const isMobileShell =
    typeof document !== "undefined" && document.documentElement.classList.contains("mobile-shell");
  const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  if (previewEnabled && isTauri && !isMobileShell && /^https?:\/\//i.test(url)) {
    const { useModalStore } = await import("@/hooks/use-modal-store");
    useModalStore.getState().onOpen("linkPreview", { url });
    return;
  }
  await openExternalUrl(url);
}

/**
 * Copies plain text to the system clipboard via Tauri clipboard manager plugin,
 * falling back to navigator.clipboard.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    await writeText(text);
    return true;
  } catch (err) {
    console.warn("Tauri clipboard plugin failed, trying browser clipboard API:", err);
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (fallbackErr) {
      console.error("Clipboard copy failed:", fallbackErr);
      return false;
    }
  }
}

/**
 * Extracts a clean filename from a URL or uses a fallback.
 */
export function getFilenameFromUrl(url: string, defaultName = "downloaded_image.png"): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    const basename = pathname.split("/").pop();
    if (basename && basename.includes(".")) {
      return decodeURIComponent(basename);
    }
  } catch (_) {
    // Return defaultName on parse error
  }
  return defaultName;
}

/**
 * Saves an image URL to the user's local filesystem using Tauri dialog and fs plugins,
 * falling back to standard browser link download.
 */
export async function saveImageToFile(url: string, suggestedName?: string): Promise<boolean> {
  if (!url) return false;

  const fileName = suggestedName || getFilenameFromUrl(url);
  const extension = fileName.split(".").pop()?.toLowerCase() || "png";

  try {
    // 1. Open native system Save File Dialog
    const selectedPath = await save({
      defaultPath: fileName,
      filters: [
        {
          name: "Image",
          extensions: [extension, "png", "jpg", "jpeg", "webp", "gif", "svg"].filter(
            (v, i, a) => a.indexOf(v) === i
          ),
        },
      ],
    });

    if (!selectedPath) {
      // User cancelled save dialog
      return false;
    }

    // 2. Fetch image content as ArrayBuffer
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();

    // 3. Write binary data directly to disk via Tauri FS plugin
    await writeFile(selectedPath, new Uint8Array(buffer));
    return true;
  } catch (err) {
    console.warn("Tauri system save failed, using browser download fallback:", err);

    // Fallback: Web browser download link
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
      return true;
    } catch (fallbackErr) {
      console.error("Browser download fallback failed:", fallbackErr);
      return false;
    }
  }
}

/**
 * Calculates byte length of text formatted for IRC transmission.
 */
export function getIrcByteCount(text: string): number {
  if (!text) return 0;
  const ircMessage = text.replace(/\r?\n/g, "\u0085");
  return new TextEncoder().encode(ircMessage).length;
}

/**
 * Calculates maximum message byte budget for PRIVMSG to a target.
 */
export function getIrcMaxMessageBytes(
  target: string,
  nick?: string,
  username?: string,
  host?: string
): number {
  const defaultNick = nick || "user";
  const defaultUser = username || defaultNick;
  const defaultHost = host || "localhost";
  const rawPrefix = `:${defaultNick}!${defaultUser}@${defaultHost} PRIVMSG ${target} :\r\n`;
  const overhead = new TextEncoder().encode(rawPrefix).length;
  return Math.max(0, 512 - overhead);
}
