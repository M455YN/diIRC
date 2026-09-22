import { useState, useEffect, useMemo, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";
import { useChangelog } from "@/lib/changelog-service";
import { MarkdownRenderer } from "@/lib/markdown/markdown-renderer";
import { parseMarkdownContentBlocks } from "@/lib/markdown/markdown-utils";
import { LinkPreview } from "@/components/chat/link-preview";
import { 
  History, 
  ChevronDown, 
  ChevronRight, 
  Loader2, 
  AlertCircle, 
  RotateCw,
  Sparkles,
  Tag,
  WifiOff
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const ChangelogModal = () => {
  const { isOpen, onClose, type } = useModal();
  const isModalOpen = isOpen && type === "changelog";

  const { versions, hasCurrentVersion, currentVersion, loading, error, refresh } = useChangelog();

  // Expanded version items state (Set of version strings)
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());

  const prevOpenRef = useRef(false);

  // Fetch fresh Gist content whenever modal opens
  useEffect(() => {
    if (isModalOpen && !prevOpenRef.current) {
      refresh();
    }
    prevOpenRef.current = isModalOpen;
  }, [isModalOpen, refresh]);

  // Set default expanded version to the latest (first) version whenever versions change or modal opens
  useEffect(() => {
    if (isModalOpen && versions.length > 0) {
      // Latest version is the first element after descending sort
      setExpandedVersions((prev) => {
        if (prev.size === 0) {
          return new Set([versions[0].version]);
        }
        return prev;
      });
    }
  }, [isModalOpen, versions]);

  const toggleVersion = (versionStr: string) => {
    setExpandedVersions((prev) => {
      const next = new Set(prev);
      if (next.has(versionStr)) {
        next.delete(versionStr);
      } else {
        next.add(versionStr);
      }
      return next;
    });
  };

  const handleClose = () => {
    onClose();
  };

  const cleanCurrentVersion = useMemo(() => {
    return currentVersion.replace(/^v/i, "").trim();
  }, [currentVersion]);

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden sm:max-w-5xl w-[94vw] h-[88vh] max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl">
        {/* Modal Header */}
        <DialogHeader className="pt-5 px-6 pb-4 shrink-0 border-b border-zinc-200 dark:border-zinc-800 flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center text-indigo-500 shrink-0">
              <History className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-x-2">
                <span>Changelog</span>
                <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                  v{cleanCurrentVersion}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Release notes and update history for Luna IRC
              </DialogDescription>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refresh()}
            disabled={loading}
            className="h-8 w-8 p-0 rounded-lg text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200"
            title="Refresh changelog"
          >
            <RotateCw className={cn("w-4 h-4", loading && "animate-spin text-indigo-500")} />
          </Button>
        </DialogHeader>

        {/* Modal Body */}
        <div className="px-6 py-4 overflow-y-auto discord-scrollbar-chat flex-1 space-y-3 min-h-[250px] flex flex-col justify-start">
          {loading && versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 my-auto space-y-3 text-zinc-500 dark:text-zinc-400">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-sm font-medium">Loading release notes...</p>
            </div>
          ) : error && versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center my-auto">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/20 flex items-center justify-center text-rose-500 shadow-sm">
                <WifiOff className="w-8 h-8" />
              </div>
              <div className="space-y-1.5 max-w-md">
                <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Unable to load release notes
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {error}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refresh()}
                disabled={loading}
                className="mt-2 text-xs font-semibold border-zinc-300 dark:border-zinc-700 flex items-center gap-x-2 px-4 py-2"
              >
                <RotateCw className={cn("w-3.5 h-3.5", loading && "animate-spin text-indigo-500")} />
                <span>{loading ? "Connecting..." : "Try again"}</span>
              </Button>
            </div>
          ) : versions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500 dark:text-zinc-400">
              <Tag className="w-8 h-8 opacity-50 mb-2" />
              <p className="text-sm font-medium">No release notes available</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((v, index) => {
                const isExpanded = expandedVersions.has(v.version);
                const isCurrent = v.cleanVersion.toLowerCase() === cleanCurrentVersion.toLowerCase();
                const isLatest = index === 0;

                return (
                  <div
                    key={v.version}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-[#2B2D31]/80 overflow-hidden transition-all duration-200"
                  >
                    {/* Collapsible Header */}
                    <button
                      type="button"
                      onClick={() => toggleVersion(v.version)}
                      className={cn(
                        "w-full px-4 py-3 flex items-center justify-between text-left transition select-none",
                        "hover:bg-zinc-100/80 dark:hover:bg-zinc-800/60",
                        isExpanded && "bg-zinc-100/70 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800/80"
                      )}
                    >
                      <div className="flex items-center gap-x-3 min-w-0">
                        <div className="text-zinc-500 dark:text-zinc-400 transition-transform duration-200 shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-indigo-500" />
                          ) : (
                            <ChevronRight className="w-4 h-4" />
                          )}
                        </div>

                        <span className="font-bold text-sm font-mono text-zinc-900 dark:text-zinc-100 truncate">
                          {v.version}
                        </span>

                        {isCurrent && (
                          <span className="inline-flex items-center gap-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
                            Current version
                          </span>
                        )}

                        {isLatest && !isCurrent && (
                          <span className="inline-flex items-center gap-x-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
                            <Sparkles className="w-3 h-3" />
                            Latest
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Collapsible Content */}
                    {isExpanded && (
                      <div className="p-4 space-y-3 bg-white/40 dark:bg-[#2B2D31]/40">
                        {(() => {
                          const blocks = parseMarkdownContentBlocks(v.content, true);
                          return (
                            <div className="text-sm text-zinc-800 dark:text-zinc-200 space-y-3">
                              {blocks.map((block) => (
                                <div key={block.id} className="space-y-2">
                                  {block.markdown.trim() && (
                                    <MarkdownRenderer content={block.markdown} compact allowImages={true} />
                                  )}
                                  {block.urls.length > 0 && (
                                    <div className="space-y-2 my-2 max-w-2xl">
                                      {block.urls.map((url) => (
                                        <LinkPreview key={url} url={url} />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-zinc-100 dark:bg-[#2b2d31] flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            {hasCurrentVersion ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Changelog available for current version (v{cleanCurrentVersion})
              </span>
            ) : (
              <span className="text-zinc-500 dark:text-zinc-400 font-medium">
                Version v{cleanCurrentVersion} release notes pending in Gist
              </span>
            )}
          </span>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleClose}
            className="text-xs border border-zinc-300 dark:border-zinc-700"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
