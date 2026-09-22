import React, { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useParams } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";
import {
  ScrollText,
  Server as ServerIcon,
  Loader2,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { openExternalUrl } from "@/lib/system-utils";
import { MarkdownRenderer } from "@/lib/markdown/markdown-renderer";
import { extractUrlsFromMarkdownText } from "@/lib/markdown/markdown-utils";
import { isImageUrl, isVideoUrl } from "@/lib/image-utils";
import {
  hasIrcControlCodes,
  IrcLineRenderer,
  IrcMonospaceLineRenderer,
  detectMotdFormat,
  stripIrcCodes,
} from "@/lib/irc-formatting";
import { LinkPreview } from "@/components/chat/link-preview";
import { ServerMotdDisplayPolicy } from "@/types";
import { cn } from "@/lib/utils";

export const MotdModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const params = useParams();
  const servers = useMockStore((state) => state.servers);
  const serverMotds = useMockStore((state) => state.serverMotds);
  const globalMotdPolicy = useMockStore((state) => state.globalMotdPolicy);
  const serverMotdPolicies = useMockStore((state) => state.serverMotdPolicies);
  const setServerMotdPolicy = useMockStore((state) => state.setServerMotdPolicy);
  const setGlobalMotdPolicy = useMockStore((state) => state.setGlobalMotdPolicy);
  const markServerMotdSeen = useMockStore((state) => state.markServerMotdSeen);
  const enableMotdMediaPreviews = useMockStore((state) => state.enableMotdMediaPreviews ?? false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const activeServerId = data?.server?.id || data?.serverId || params.serverId || servers[0]?.id;
  const activeServer = (activeServerId ? servers.find((s) => s.id === activeServerId) : null) || servers[0];

  const rawMotdLines = (activeServerId && serverMotds[activeServerId]) || data?.motd || activeServer?.motd || [];

  const [isRefreshing, setIsRefreshing] = useState(false);

  const isModalOpen = isOpen && type === "motd";

  // Automatically refresh MOTD whenever the modal opens or active server changes
  useEffect(() => {
    if (isModalOpen && activeServerId) {
      setIsRefreshing(true);
      invoke("request_motd", { serverId: activeServerId })
        .catch((err) => {
          console.warn("Auto-fetch MOTD error:", err);
        })
        .finally(() => {
          setTimeout(() => setIsRefreshing(false), 800);
        });
    }
  }, [isModalOpen, activeServerId]);

  // Mark MOTD as seen upon viewing
  useEffect(() => {
    if (isModalOpen && activeServerId && rawMotdLines.length > 0) {
      markServerMotdSeen(activeServerId, rawMotdLines);
    }
  }, [isModalOpen, activeServerId, rawMotdLines, markServerMotdSeen]);

  const handleClose = () => {
    if (activeServerId && rawMotdLines.length > 0) {
      markServerMotdSeen(activeServerId, rawMotdLines);
    }
    onClose("motd");
  };

  // Inspect MOTD for diIRC formatting tag vs standard IRC ASCII art
  const { isDirc, cleanedLines: motdLines } = useMemo(() => {
    return detectMotdFormat(rawMotdLines);
  }, [rawMotdLines]);

  // Extract all media/web links from the MOTD content for clickable link list in ASCII mode
  const detectedUrls = useMemo(() => {
    if (!motdLines.length) return [];
    return extractUrlsFromMarkdownText(motdLines.join("\n"));
  }, [motdLines]);

  // Dynamic scaling based on mode, content length, and ASCII art width
  const modalMaxWidth = useMemo(() => {
    if (!motdLines.length) return "max-w-lg";

    const totalLines = motdLines.length;
    const maxLineLength = Math.max(0, ...motdLines.map((l) => stripIrcCodes(l).length));
    const hasMedia = enableMotdMediaPreviews && detectedUrls.some((u) => isImageUrl(u) || isVideoUrl(u) || /youtu\.?be/.test(u));

    if (isDirc) {
      if (hasMedia) return "max-w-3xl lg:max-w-4xl";
      if (totalLines > 16 || maxLineLength > 85) return "max-w-3xl";
      if (totalLines > 7 || maxLineLength > 55) return "max-w-2xl";
      return "max-w-xl";
    }

    // Standard IRC Monospace ASCII Mode
    if (maxLineLength > 80) return "max-w-4xl lg:max-w-5xl";
    if (maxLineLength > 65 || totalLines > 20) return "max-w-3xl lg:max-w-4xl";
    if (maxLineLength > 45 || totalLines > 10) return "max-w-2xl";
    return "max-w-xl";
  }, [motdLines, isDirc]);

  const serverDisplayName = activeServer?.name || activeServer?.host || "Server";

  const rawServerPolicy = (activeServerId && serverMotdPolicies[activeServerId]) || activeServer?.motdPolicy;
  const currentPolicy: ServerMotdDisplayPolicy =
    rawServerPolicy || (globalMotdPolicy === "never" ? "never_globally" : "default");

  const handlePolicyChange = (newPolicy: ServerMotdDisplayPolicy) => {
    if (newPolicy === "never_globally") {
      setGlobalMotdPolicy("never");
      if (activeServerId) {
        setServerMotdPolicy(activeServerId, "never_globally");
        if (rawMotdLines.length > 0) {
          markServerMotdSeen(activeServerId, rawMotdLines);
        }
      }
    } else {
      if (activeServerId) {
        setServerMotdPolicy(activeServerId, newPolicy);
        if (rawMotdLines.length > 0) {
          markServerMotdSeen(activeServerId, rawMotdLines);
        }
      }
    }
  };

  const globalPolicyLabel =
    globalMotdPolicy === "always"
      ? "Always"
      : globalMotdPolicy === "never"
      ? "Don't show again (all servers)"
      : "When changed";

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          closeButtonRef.current?.focus();
        }}
        className={cn(
          "bg-white dark:bg-[#313338] text-black dark:text-white p-0 overflow-hidden rounded-xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-[94vw] transition-all duration-200 max-h-[90vh] flex flex-col",
          modalMaxWidth
        )}
      >
        <DialogHeader className="pt-4 px-6 pb-2 shrink-0 border-b border-zinc-100 dark:border-zinc-800/50">
          <DialogTitle className="text-lg font-bold flex items-center gap-x-2 flex-wrap">
            <ScrollText className="w-5 h-5 text-indigo-500 shrink-0" />
            <span>Message of the day</span>
            {isDirc && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/60 select-none ml-1">
                <Sparkles className="w-3 h-3" />
                Luna IRC format
              </span>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400">
            {serverDisplayName}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-3 overflow-y-auto discord-scrollbar-chat flex-1 min-h-0">
          {motdLines.length > 0 ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/70 dark:bg-[#2B2D31]/70 p-4 select-text transition-all">
              {isDirc ? (
                /* ========================================================================= */
                /* Luna IRC Enhanced Mode: Markdown Lines with In-Place Media Embeds         */
                /* ========================================================================= */
                <div className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed break-words space-y-2">
                  {motdLines.map((line, idx) => {
                    const lineUrls = enableMotdMediaPreviews ? extractUrlsFromMarkdownText(line) : [];

                    return (
                      <div key={idx} className="space-y-2">
                        <div className="min-h-[1.25rem]">
                          {hasIrcControlCodes(line) ? (
                            <IrcLineRenderer line={line} />
                          ) : line.trim() ? (
                            <MarkdownRenderer content={line} compact allowImages={enableMotdMediaPreviews} />
                          ) : (
                            <div className="h-2" />
                          )}
                        </div>

                        {/* In-place media previews directly under the line where they appear */}
                        {lineUrls.length > 0 && (
                          <div className="space-y-2 my-2 max-w-2xl">
                            {lineUrls.map((url, urlIdx) => (
                              <LinkPreview key={urlIdx} url={url} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* ========================================================================= */
                /* Standard IRC Mode: Clean Monospace ASCII Art & Banner Fidelity            */
                /* ========================================================================= */
                <div className="space-y-3">
                  <div className="font-mono text-sm leading-[1.35] text-zinc-800 dark:text-zinc-200 select-text overflow-x-auto discord-scrollbar-chat whitespace-pre font-['Consolas','Cascadia_Code','Courier_New','Menlo',monospace]">
                    {motdLines.map((line, idx) => (
                      <IrcMonospaceLineRenderer key={idx} line={line} />
                    ))}
                  </div>

                  {/* Extracted Clickable Links under the ASCII Art */}
                  {detectedUrls.length > 0 && (
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100/70 dark:bg-[#1e1f22]/70 p-3 text-xs space-y-1.5 mt-3">
                      <div className="font-semibold text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Links in MOTD
                      </div>
                      <div className="flex flex-col gap-1">
                        {detectedUrls.map((url, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => openExternalUrl(url)}
                            className="text-left text-indigo-600 dark:text-indigo-400 hover:underline truncate"
                            title={url}
                          >
                            {url}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : isRefreshing ? (
            <div className="p-10 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-[#2b2d31] flex flex-col items-center justify-center text-center space-y-3">
              <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  Fetching message of the day...
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Connecting to {serverDisplayName} to retrieve the latest MOTD.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-[#2b2d31] flex flex-col items-center justify-center text-center space-y-3">
              <div className="p-3 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
                <ServerIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                  No message of the day available
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm">
                  The server did not send a MOTD or the MOTD file is empty.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions — Fixed at the bottom of the modal */}
        <DialogFooter className="px-6 py-3 bg-zinc-50/80 dark:bg-[#2B2D31]/80 border-t border-zinc-200 dark:border-zinc-800 shrink-0 flex flex-row items-center justify-end gap-x-3">
          <div className="flex items-center gap-x-2">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap select-none">
              Show on connect:
            </span>
            <Select
              value={currentPolicy}
              onValueChange={(val: ServerMotdDisplayPolicy) => handlePolicyChange(val)}
            >
              <SelectTrigger className="h-8 text-xs bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 min-w-[155px]">
                <SelectValue placeholder="Display policy" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-[#2B2D31] border-zinc-200 dark:border-zinc-800 text-xs">
                <SelectItem value="default">Default ({globalPolicyLabel})</SelectItem>
                <SelectItem value="on_change">Only when changed</SelectItem>
                <SelectItem value="always">Always show</SelectItem>
                <SelectItem value="never">Don't show again (this server)</SelectItem>
                <SelectItem value="never_globally">Don't show again (all servers)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            ref={closeButtonRef}
            type="button"
            variant="default"
            size="sm"
            onClick={handleClose}
            className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
