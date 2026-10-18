import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Copy, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";
import { copyToClipboard, linkHost, linkLooksSuspicious, openLink } from "@/lib/system-utils";

/** Asks before a link from the chat is opened; sites can be trusted so they are not asked about again. */
export const ExternalLinkModal = () => {
  const { t } = useTranslation();
  const { isOpen, onClose, type, data } = useModal();
  const isModalOpen = isOpen && type === "externalLink";
  const url = data.url ?? "";
  const host = linkHost(url);
  const trustLinkHost = useMockStore((state) => state.trustLinkHost);
  const [trust, setTrust] = useState(false);
  const suspicious = linkLooksSuspicious(url);

  const open = () => {
    if (trust && host) trustLinkHost(host);
    onClose();
    void openLink(url, "link", true);
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-x-2">
            <ExternalLink className="h-5 w-5 text-indigo-500" />
            {t("externalLink.title")}
          </DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">{t("externalLink.desc")}</DialogDescription>
        </DialogHeader>
        <p className="break-all rounded-md bg-zinc-100 p-2 font-mono text-xs dark:bg-zinc-800">{url}</p>
        {suspicious && (
          <p className="flex items-start gap-x-2 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {t("externalLink.suspicious")}
          </p>
        )}
        {host && (
          <label className="flex items-center gap-x-2 text-xs text-zinc-600 dark:text-zinc-300">
            <input type="checkbox" checked={trust} onChange={(e) => setTrust(e.target.checked)} />
            {t("externalLink.trust", { host })}
          </label>
        )}
        <div className="flex justify-end gap-x-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t("externalLink.cancel")}
          </Button>
          <Button type="button" variant="outline" onClick={() => void copyToClipboard(url)}>
            <Copy className="mr-1.5 h-3.5 w-3.5" />
            {t("externalLink.copy")}
          </Button>
          <Button type="button" variant="primary" onClick={open} className="bg-indigo-600 text-white hover:bg-indigo-700">
            {t("externalLink.open")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
