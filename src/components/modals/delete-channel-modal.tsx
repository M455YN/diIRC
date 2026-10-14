import { useTranslation } from "react-i18next";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { Button } from "@/components/ui/button";
import { useMockStore } from "@/lib/mock-store";

export const DeleteChannelModal = () => {
  const { t: tr } = useTranslation();
  const { isOpen, onClose, type, data } = useModal();
  const navigate = useNavigate();
  const deleteChannel = useMockStore((state) => state.deleteChannel);

  const isModalOpen = isOpen && type === "deleteChannel";
  const { server, channel } = data;

  const [isLoading, setIsLoading] = useState(false);

  const onClick = async () => {
    try {
      setIsLoading(true);
      if (server?.id && channel?.id) {
        deleteChannel(server.id, channel.id);
      }

      onClose();
      if (server?.id) {
        navigate(`/servers/${server.id}`);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl">
        <DialogHeader className="pt-6 px-6 space-y-2">
          <DialogTitle className="text-2xl text-center font-bold text-zinc-900 dark:text-zinc-100">
            {tr("rest.leaveChannel")}
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400">
            {tr("dc.leaveQuestion")} <span className="text-indigo-600 dark:text-indigo-400 font-semibold">#{channel?.name}</span>? <br />
            {tr("rest.leaveChannelDesc")}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="bg-zinc-100/90 dark:bg-[#2b2d31] border-t border-zinc-200 dark:border-zinc-800/80 px-6 py-4 flex items-center justify-between">
          <Button
            disabled={isLoading}
            onClick={onClose}
            variant="ghost"
            className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
          >
            {tr("common.cancel")}
          </Button>
          <Button
            disabled={isLoading}
            onClick={onClick}
            className="bg-rose-600 hover:bg-rose-700 text-white font-medium px-6 shadow-sm"
          >
            {tr("rest.leaveChannel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
