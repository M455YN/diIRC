import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { ExternalLink, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal-store";
import { openExternalUrl } from "@/lib/system-utils";

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/**
 * Shows a chat link inside the app. The page itself is a native webview that the backend places over
 * the empty content area of this modal (a DOM iframe is refused by most sites), so this component's
 * job is the frame around it and keeping the webview glued to that area.
 */
export const LinkPreviewModal = () => {
  const { t } = useTranslation();
  const { isOpen, onClose, type, data } = useModal();
  const isModalOpen = isOpen && type === "linkPreview";
  const url = data?.url || "";

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const openedRef = useRef(false);
  const [failed, setFailed] = useState(false);

  const sync = useCallback(async () => {
    const el = bodyRef.current;
    if (!el || !url) return;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const args = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    try {
      if (!openedRef.current) {
        openedRef.current = true;
        await invoke("link_preview_open", { url, ...args });
      } else {
        await invoke("link_preview_bounds", args);
      }
    } catch (err) {
      console.warn("Link preview failed, opening in the browser:", err);
      openedRef.current = false;
      setFailed(true);
    }
  }, [url]);

  // Open the webview once the dialog is laid out, then follow it while it animates or the window resizes.
  useEffect(() => {
    if (!isModalOpen || !url) return;
    setFailed(false);
    openedRef.current = false;

    const timers = [0, 120, 320].map((delay) => window.setTimeout(() => void sync(), delay));
    const el = bodyRef.current;
    const observer = el ? new ResizeObserver(() => void sync()) : null;
    if (el && observer) observer.observe(el);
    const onResize = () => void sync();
    window.addEventListener("resize", onResize);

    return () => {
      timers.forEach((id) => window.clearTimeout(id));
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
      openedRef.current = false;
      void invoke("link_preview_close").catch(() => {});
    };
  }, [isModalOpen, url, sync]);

  // A page that cannot be embedded here falls back to the system browser.
  useEffect(() => {
    if (!failed || !url) return;
    void openExternalUrl(url);
    onClose();
  }, [failed, url, onClose]);

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideClose
        className="flex h-[88vh] max-h-[90vh] w-[94vw] flex-col gap-0 overflow-hidden rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-[#313338] dark:text-zinc-100 sm:max-w-6xl"
      >
        <div className="flex shrink-0 items-center gap-x-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {hostOf(url)}
            </DialogTitle>
            <DialogDescription className="truncate text-[11px] text-zinc-500 dark:text-zinc-400" title={url}>
              {url}
            </DialogDescription>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void openExternalUrl(url)}
            title={t("linkPreview.openInBrowser")}
            className="h-8 gap-x-1.5 text-xs font-semibold"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="hidden sm:inline">{t("linkPreview.openInBrowser")}</span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label={t("common.close")}
            title={t("common.close")}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {/* Left empty on purpose: the native webview is placed over this area. */}
        <div ref={bodyRef} className="min-h-0 flex-1 bg-white dark:bg-[#1e1f22]" />
      </DialogContent>
    </Dialog>
  );
};
