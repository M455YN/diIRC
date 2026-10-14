import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
}

export const ComingSoonModal = ({
  isOpen,
  onClose,
  title = "Coming soon",
  description = "This feature is temporarily disabled while undergoing maintenance and code restructuring.",
}: ComingSoonModalProps) => {
  const { t: tr } = useTranslation();
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl">
        <div className="p-6 space-y-4">
          <DialogHeader className="pt-2 space-y-3 text-center flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-500">
              <Clock className="w-6 h-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
              {title}
            </DialogTitle>
            <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
              {description}
            </DialogDescription>
          </DialogHeader>

          <div className="pt-2 flex justify-end">
            <Button
              type="button"
              onClick={onClose}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 text-xs shadow-sm"
            >
              {tr("common.close")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
