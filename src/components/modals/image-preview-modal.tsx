import { useModal } from "@/hooks/use-modal-store";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ExternalLink, Download, X } from "lucide-react";
import { ImageContextMenu } from "@/components/image-context-menu";
import { openExternalUrl, saveImageToFile } from "@/lib/system-utils";
import { SmartImage } from "@/components/chat/smart-image";

export const ImagePreviewModal = () => {
  const { t } = useTranslation();
  const { isOpen, onClose, type, data } = useModal();

  const isModalOpen = isOpen && type === "imagePreview";
  const { url } = data;

  if (!url) return null;

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent hideClose className="bg-zinc-950/95 border-zinc-800 text-white p-2 overflow-hidden max-w-5xl max-h-[92vh] flex flex-col items-center justify-center backdrop-blur-md shadow-2xl rounded-2xl">
        <DialogTitle className="sr-only">Image preview</DialogTitle>
        <DialogDescription className="sr-only">Full size view of the selected image</DialogDescription>

        {/* Floating Custom Header Controls */}
        <div className="absolute top-4 right-4 flex items-center gap-x-2 z-50">
          <button
            type="button"
            onClick={() => saveImageToFile(url)}
            className="p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 hover:text-white transition shadow-md"
            title={t("image.saveImage")}
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => openExternalUrl(url)}
            className="p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 hover:text-white transition shadow-md"
            title={t("image.openInBrowser")}
          >
            <ExternalLink className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 hover:text-white transition shadow-md"
            title={t("image.close")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Expanded Image View */}
        <div className="relative w-full h-full flex items-center justify-center p-4 pt-12">
          <ImageContextMenu url={url}>
            <SmartImage
              src={url}
              alt={t("image.expandedPreview")}
              className="max-h-[82vh] max-w-full object-contain rounded-lg shadow-2xl select-none cursor-pointer"
              containerClassName="max-h-[82vh] max-w-full"
            />
          </ImageContextMenu>
        </div>
      </DialogContent>
    </Dialog>
  );
};
