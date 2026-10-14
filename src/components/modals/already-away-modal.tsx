import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMockStore, getServerActiveNick } from "@/lib/mock-store";
import { invoke } from "@tauri-apps/api/core";

export const AlreadyAwayModal = () => {
  const { t } = useTranslation();
  const { isOpen, onClose, type, data } = useModal();

  const isModalOpen = isOpen && type === "alreadyAway";
  const serverId = data.serverId;

  const handleReturnFromAway = async () => {
    if (serverId) {
      try {
        await invoke("send_away", { serverId, reason: null });
      } catch (err) {
        console.error("Failed to send /back via Tauri IRC:", err);
      }
      const store = useMockStore.getState();
      const server = store.servers.find((s) => s.id === serverId);
      const ourNick = server ? getServerActiveNick(server) : store.currentProfile.name;
      store.setUserAway(serverId, ourNick, false);
      store.setSelfAway(serverId, false);
    }
    onClose();
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white p-0 overflow-hidden rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 z-[100]">
        <DialogHeader className="pt-8 px-6 space-y-2">
          <DialogTitle className="text-2xl text-center font-bold flex items-center justify-center gap-x-2 text-amber-500">
            <AlertCircle className="w-6 h-6 shrink-0" />
            {t("away.title")}
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400 mt-2">
            {t("away.desc")}
          </DialogDescription>
        </DialogHeader>

        <div className="bg-gray-100 dark:bg-zinc-900/50 p-6 flex flex-col gap-y-4">
          <div className="text-sm text-zinc-500 dark:text-zinc-400 text-center">
            Clicking <b>{t("common.back")}</b> will return you from the away state, making you active again.
          </div>
          <div className="flex gap-x-4">
            <Button onClick={onClose} variant="ghost" className="w-full">
              Ok
            </Button>
            <Button onClick={handleReturnFromAway} variant="primary" className="w-full">
              {t("common.back")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
