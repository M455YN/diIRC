import { useTranslation } from "react-i18next";
import { useState, useEffect, useRef } from "react";
import { Film, Play, Volume2 } from "lucide-react";
import { useIntersectionObserver } from "@/hooks/use-intersection-observer";
import { getFilenameFromUrl } from "@/lib/system-utils";

interface LazyVideoEmbedProps {
  url: string;
  onContentSizeChange?: () => void;
}

/**
 * High-performance Lazy Video Embed using the facade pattern + IntersectionObserver.
 *
 * 1. Off-screen: Zero network/decoder allocation (lightweight placeholder).
 * 2. In viewport: Displays a Discord-style video facade (poster / play overlay).
 * 3. On play click: Mounts native HTML5 <video controls autoPlay />.
 * 4. Off-screen unmount: When scrolled >400px away, unmounts the <video> to free
 *    hardware video decoders and GPU resources in WebView2/Chromium.
 */
export const LazyVideoEmbed: React.FC<LazyVideoEmbedProps> = ({
  url,
  onContentSizeChange,
}) => {
  const { t: tr } = useTranslation();
  const { ref, isVisible } = useIntersectionObserver({
    root: null,
    rootMargin: "400px",
    threshold: 0,
    freezeOnceVisible: true,
  });

  const [isActivated, setIsActivated] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const filename = getFilenameFromUrl(url, "video.mp4");
  const ext = filename.split(".").pop()?.toUpperCase() || "VIDEO";

  const handleActivate = () => {
    setIsActivated(true);
  };

  return (
    <div
      ref={ref}
      className="mt-2 max-w-md w-full rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-black shadow-md"
    >
      <div className="relative w-full pt-[56.25%] bg-zinc-900">
        {!isVisible ? (
          // Skeleton placeholder while off-screen — exact same fixed aspect ratio
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-900 animate-pulse text-zinc-600">
            <Film className="w-8 h-8" />
            <span className="text-[11px] font-mono text-zinc-500">{ext}</span>
          </div>
        ) : !isActivated ? (
          // Lightweight Facade (zero video decoder cost until clicked)
          <button
            type="button"
            onClick={handleActivate}
            aria-label={`Play video ${filename}`}
            className="absolute inset-0 w-full h-full group cursor-pointer overflow-hidden bg-zinc-950 flex flex-col items-center justify-center"
          >
            {/* Background subtle gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/60 group-hover:from-black/70 transition-colors" />

            {/* Center play icon */}
            <div className="relative z-10 flex items-center justify-center w-14 h-14 rounded-full bg-indigo-600/90 text-white shadow-lg group-hover:bg-indigo-500 group-hover:scale-110 group-active:scale-95 transition-all duration-200">
              <Play className="w-6 h-6 fill-white ml-0.5" />
            </div>

            {/* Top / Bottom metadata label */}
            <div className="absolute top-2.5 left-3 right-3 flex items-center justify-between z-10 pointer-events-none">
              <span className="text-xs text-zinc-200 font-medium truncate max-w-[80%] drop-shadow-md">
                {filename}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-black/60 text-[10px] font-mono font-semibold text-zinc-300 uppercase border border-white/10">
                {ext}
              </span>
            </div>

            <div className="absolute bottom-2.5 left-3 z-10 pointer-events-none flex items-center gap-x-1.5 text-[11px] text-zinc-400">
              <Volume2 className="w-3.5 h-3.5" />
              <span>{tr("cb.clickToPlay")}</span>
            </div>
          </button>
        ) : (
          // Active HTML5 Video Player
          <video
            ref={videoRef}
            src={url}
            controls
            autoPlay
            playsInline
            className="absolute inset-0 w-full h-full object-contain rounded-lg"
            onLoadedMetadata={onContentSizeChange}
          />
        )}
      </div>
    </div>
  );
};
