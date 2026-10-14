import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { AlertTriangle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFlagTip } from "@/lib/flag-tips";

export const IrcErrorModal = () => {
  const { t: tr } = useTranslation();
  const { isOpen, onClose, type, data, errorData } = useModal();

  const isModalOpen = (isOpen && type === "ircError") || errorData !== null;
  const activeData = errorData || data;

  const title = activeData.title || "IRC error";
  const description =
    activeData.description ||
    activeData.errorMessage ||
    "Cannot send message because you are disconnected from the IRC server. Please check your connection and try again.";

  const flagTip = getFlagTip(activeData.flag, description);

  const handleClose = () => {
    onClose("ircError");
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white p-0 overflow-hidden rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 z-[100]">
        <DialogHeader className="pt-8 px-6 space-y-2">
          <DialogTitle className="text-2xl text-center font-bold flex items-center justify-center gap-x-2 text-rose-500">
            <AlertTriangle className="w-6 h-6 shrink-0" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400 mt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        {flagTip && (
          <div className="mx-6 mt-4 p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 flex items-start gap-x-3 text-xs leading-relaxed">
            <Lightbulb className="w-4 h-4 shrink-0 text-blue-500 dark:text-blue-400 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5 text-blue-600 dark:text-blue-400">
                Tip
              </span>
              {flagTip.tip}
            </div>
          </div>
        )}

        <div className="p-6 flex justify-center mt-2">
          <Button onClick={handleClose} variant="primary" className="w-full">
            {tr("rest.gotIt")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
