import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal-store";
import { 
  DownloadCloud, 
  Sparkles, 
  AlertCircle, 
  ExternalLink, 
  CheckCircle2, 
  Loader2, 
  ArrowRight 
} from "lucide-react";
import { 
  installAppUpdate, 
  openGitHubReleases, 
  UpdateProgress 
} from "@/lib/update-service";
import { Update } from "@tauri-apps/plugin-updater";

/** The release notes as plain text for the small box below: images (markdown or <img>) are left out, not shown as code. */
const notesText = (body: string) =>
  body
    .replace(/!\[[^\]]*\]\([^)]*\)|<img\b[^>]*>/gi, "")
    .replace(/^[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

export const UpdateModal = () => {
  const { t } = useTranslation();
  const { isOpen, onClose, type, data } = useModal();
  const isModalOpen = isOpen && type === "updateAvailable";

  const updateInfo = data?.updateInfo;
  const updateRef = (data as any)?.updateRef as Update | undefined;

  const [progress, setProgress] = useState<UpdateProgress>({
    status: "idle",
    downloadedBytes: 0,
    totalBytes: 0,
    percentage: 0,
  });

  const handleClose = () => {
    if (progress.status === "backing_up" || progress.status === "downloading" || progress.status === "installing") {
      // Prevent accidental close during backup or installation
      return;
    }
    setProgress({
      status: "idle",
      downloadedBytes: 0,
      totalBytes: 0,
      percentage: 0,
    });
    onClose();
  };

  const handleStartUpdate = async () => {
    if (!updateRef && !updateInfo?.onUpdate) {
      // Fallback if no direct update ref
      await openGitHubReleases();
      return;
    }

    try {
      if (updateRef) {
        await installAppUpdate(updateRef, (p) => setProgress(p));
      } else if (updateInfo?.onUpdate) {
        await updateInfo.onUpdate();
      }
    } catch (err: any) {
      console.error("Update process failed:", err);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return "0 MB";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden sm:max-w-lg border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl">
        <DialogHeader className="pt-6 px-6 space-y-2">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 mb-1">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <DialogTitle className="text-xl text-center font-bold text-zinc-900 dark:text-zinc-100">
            {t("update.newVersion")}
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400 text-xs">
            {t("update.available")}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Version badge */}
          <div className="flex items-center justify-center gap-x-3 p-3 rounded-xl bg-zinc-100 dark:bg-[#2b2d31] border border-zinc-200 dark:border-zinc-700/60 text-xs font-semibold">
            <span className="text-zinc-500 dark:text-zinc-400 font-mono">
              v{updateInfo?.currentVersion || "0.1.7"}
            </span>
            <ArrowRight className="w-4 h-4 text-indigo-500" />
            <span className="text-indigo-600 dark:text-indigo-400 font-bold font-mono text-sm">
              v{updateInfo?.version || "0.1.8"}
            </span>
          </div>

          {/* Release Notes */}
          {updateInfo?.body && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                {t("update.whatsNew")}
              </label>
              <div className="max-h-36 overflow-y-auto p-3 rounded-lg bg-zinc-50 dark:bg-[#1e1f22] border border-zinc-200 dark:border-zinc-800 text-xs font-mono text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap break-words [overflow-wrap:anywhere] leading-relaxed">
                {notesText(updateInfo.body)}
              </div>
            </div>
          )}

          {/* Download & Install Progress Bar */}
          {(progress.status === "backing_up" || progress.status === "downloading" || progress.status === "installing") && (
            <div className="space-y-2 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <div className="flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                <span className="flex items-center gap-x-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  {progress.status === "backing_up"
                    ? t("update.backup")
                    : progress.status === "downloading" 
                    ? t("update.downloading") 
                    : t("update.installing")}
                </span>
                <span>{progress.percentage}%</span>
              </div>

              {/* Progress track */}
              <div className="w-full bg-zinc-200 dark:bg-zinc-700 h-2 rounded-full overflow-hidden">
                <div 
                  className="bg-indigo-500 h-full transition-all duration-300 ease-out"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>

              {progress.totalBytes > 0 && (
                <div className="text-[11px] text-right text-zinc-500 dark:text-zinc-400 font-mono">
                  {formatBytes(progress.downloadedBytes)} / {formatBytes(progress.totalBytes)}
                </div>
              )}
            </div>
          )}

          {/* Success state */}
          {progress.status === "ready" && (
            <div className="flex items-center gap-x-2 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              {t("update.downloaded")}
            </div>
          )}

          {/* Error / .deb Fallback state */}
          {progress.status === "error" && (
            <div className="space-y-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-xs">
              <div className="flex items-start gap-x-2 text-rose-600 dark:text-rose-400 font-semibold">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Automatic update failed</p>
                  <p className="text-[11px] font-normal opacity-90 mt-0.5">
                    {progress.isDebFallback 
                      ? t("update.debManual")
                      : progress.errorMessage}
                  </p>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={openGitHubReleases}
                className="w-full text-xs font-semibold bg-rose-500 text-white hover:bg-rose-600 flex items-center justify-center gap-x-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {progress.isDebFallback 
                  ? t("update.downloadDeb") 
                  : t("update.downloadUpdate")}
              </Button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-zinc-100 dark:bg-[#2b2d31] flex items-center justify-end gap-x-2 border-t border-zinc-200 dark:border-zinc-800">
          {progress.status !== "backing_up" && progress.status !== "downloading" && progress.status !== "installing" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              className="text-xs border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
            >
              {t("update.remindLater")}
            </Button>
          )}

          {progress.status !== "backing_up" && progress.status !== "downloading" && progress.status !== "installing" && progress.status !== "ready" && (
            <Button
              size="sm"
              onClick={handleStartUpdate}
              className="text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-x-1.5"
            >
              <DownloadCloud className="w-4 h-4" />
              {t("update.updateNow")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
