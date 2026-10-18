import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Hash } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";
import { forwardToChannel } from "@/lib/forward-message";

/** Picks the channel a message is forwarded to (opened from the message's right-click menu). */
export const ForwardMessageModal = () => {
  const { t } = useTranslation();
  const { isOpen, onClose, type, data } = useModal();
  const isModalOpen = isOpen && type === "forwardMessage";
  const server = useMockStore((state) => state.servers.find((s) => s.id === data.serverId));
  const [failed, setFailed] = useState(false);

  const send = async (channelId: string) => {
    if (!server || !data.forward) return;
    setFailed(false);
    if (await forwardToChannel(server.id, channelId, data.forward)) onClose();
    else setFailed(true);
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800">
        <DialogHeader>
          <DialogTitle>{t("chat.forward.title")}</DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">{t("chat.forward.desc")}</DialogDescription>
        </DialogHeader>
        {data.forward && (
          <p className="line-clamp-3 whitespace-pre-wrap break-words rounded-md bg-zinc-100 p-2 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {data.forward}
          </p>
        )}
        {!server?.channels.length ? (
          <p className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">{t("chat.forward.empty")}</p>
        ) : (
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {server.channels.map((channel) => (
              <li key={channel.id}>
                <button
                  type="button"
                  onClick={() => void send(channel.id)}
                  className="flex w-full items-center gap-x-2 rounded-md px-3 py-2 text-left text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-700/60"
                >
                  <Hash className="h-4 w-4 text-zinc-400" />
                  <span>{channel.name.replace(/^#/, "")}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {failed && <p className="text-xs text-rose-500">{t("chat.forward.failed")}</p>}
      </DialogContent>
    </Dialog>
  );
};
