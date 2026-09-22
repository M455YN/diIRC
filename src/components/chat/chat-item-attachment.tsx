import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { FileIcon, ExternalLink, ImageIcon, ChevronRight, ChevronDown } from "lucide-react";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";
import { ImageContextMenu } from "@/components/image-context-menu";
import { openExternalUrl, getFilenameFromUrl } from "@/lib/system-utils";
import { SmartImage } from "@/components/chat/smart-image";
import { LazyVideoEmbed } from "@/components/chat/lazy-video-embed";
import { 
  isImageUrl, 
  isVideoUrl, 
  checkIsMediaUrlAsync, 
  subscribeImageCache 
} from "@/lib/image-utils";

interface ChatItemAttachmentProps {
  fileUrl: string;
  content: string;
  onContentSizeChange?: () => void;
}

export const ChatItemAttachment = ({
  fileUrl,
  content,
  onContentSizeChange,
}: ChatItemAttachmentProps) => {
  const { onOpen } = useModal();
  const params = useParams();
  const activeServerId = params?.serverId;
  const shouldAutoCollapse = useMockStore((state) => state.shouldAutoCollapseImages(activeServerId));
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => shouldAutoCollapse);
  const [, setCacheTick] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeImageCache(() => {
      setCacheTick((prev) => prev + 1);
    });
    
    if (!isImageUrl(fileUrl) && !isVideoUrl(fileUrl)) {
      checkIsMediaUrlAsync(fileUrl);
    }

    return unsubscribe;
  }, [fileUrl]);

  const toggleCollapse = () => {
    setIsCollapsed((prev) => !prev);
    onContentSizeChange?.();
  };

  const isImage = isImageUrl(fileUrl);
  const isVideo = isVideoUrl(fileUrl);
  const filename = getFilenameFromUrl(fileUrl, "Attachment");
  const parts = filename.split(".");
  const ext = parts.length > 1 ? parts.pop()?.toUpperCase() : "IMG";

  if (isImage) {
    if (isCollapsed) {
      return (
        <div className="mt-1.5 inline-flex items-center justify-between gap-x-2.5 p-2 rounded-lg bg-zinc-100 dark:bg-[#2b2d31] border border-zinc-200 dark:border-zinc-700/60 w-fit max-w-[280px] group shadow-sm transition hover:border-zinc-300 dark:hover:border-zinc-600">
          <ImageContextMenu url={fileUrl} filename={filename} isCollapsed={isCollapsed} onToggleCollapse={toggleCollapse}>
            <div className="flex items-center gap-x-2 min-w-0 flex-1 cursor-pointer" onClick={toggleCollapse}>
              <div className="p-1.5 rounded-md bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shrink-0">
                <ImageIcon className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate" title={filename}>
                {filename}
              </span>
            </div>
          </ImageContextMenu>
          <button
            type="button"
            onClick={toggleCollapse}
            className="h-6 px-2 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 dark:hover:bg-indigo-500/20 rounded flex items-center gap-x-1 shrink-0 transition"
          >
            <span>Show</span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
        </div>
      );
    }

    return (
      <div className="mt-1 w-fit max-w-md rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm relative group">
        <ImageContextMenu url={fileUrl} filename={filename} isCollapsed={isCollapsed} onToggleCollapse={toggleCollapse}>
          <button 
            type="button"
            onClick={() => onOpen("imagePreview", { url: fileUrl })}
            className="block relative cursor-zoom-in text-left w-full h-full"
          >
            <SmartImage
              src={fileUrl}
              alt={content || "Attachment"}
              className="max-h-[320px] max-w-full w-auto h-auto object-contain rounded-lg transition hover:opacity-95 block"
              onImageLoad={onContentSizeChange}
              onImageError={onContentSizeChange}
            />
          </button>
        </ImageContextMenu>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleCollapse();
          }}
          title="Collapse image"
          aria-label="Collapse image"
          className="absolute top-2 right-2 p-1.5 rounded-md bg-black/60 hover:bg-black/80 text-white/90 hover:text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition shadow-md z-10 cursor-pointer"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (isVideo) {
    return <LazyVideoEmbed url={fileUrl} onContentSizeChange={onContentSizeChange} />;
  }

  // Generic File Attachment (PDF, ZIP, DOCX, TXT, etc.)
  return (
    <div className="relative flex items-center gap-x-3 p-3 mt-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 max-w-sm group">
      <div className="p-2 rounded-md bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shrink-0">
        <FileIcon className="h-6 w-6" />
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <button
          type="button"
          onClick={() => openExternalUrl(fileUrl)}
          className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline truncate text-left flex items-center gap-x-1"
        >
          <span className="truncate">{filename}</span>
          <ExternalLink className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition" />
        </button>
        <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
          {ext} File
        </span>
      </div>
    </div>
  );
};


