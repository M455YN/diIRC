import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useParams } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal-store";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import { useMockStore } from "@/lib/mock-store";
import { AlertCircle, CheckCircle2, RefreshCw, Shield, Wifi, Globe, Unplug } from "lucide-react";
import { useIsMobileShell } from "@/hooks/use-mobile-platform";
import { cn } from "@/lib/utils";
import { MobileConnectionDetailsModal } from "@/components/mobile/mobile-info-modals";

export const ConnectionDetailsModal = () =>
  useIsMobileShell() ? <MobileConnectionDetailsModal /> : <DesktopConnectionDetailsModal />;

const DesktopConnectionDetailsModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const isMobile = useIsMobileShell();
  const { serverId: routeServerId } = useParams();
  const servers = useMockStore((state) => state.servers);

  const urlMatch = typeof window !== "undefined" ? window.location.pathname.match(/\/servers\/([^\/]+)/) : null;
  const urlServerId = urlMatch ? urlMatch[1] : undefined;

  const targetServerId = data?.serverId || data?.server?.id || routeServerId || urlServerId;
  const { irc, ircError, resourceServer, internet } = useConnectionStatus(targetServerId);

  const currentProfile = useMockStore((state) => state.currentProfile);
  const uploadConfig = useMockStore((state) => state.uploadConfig);
  const setIrcConnected = useMockStore((state) => state.setIrcConnected);
  const disconnectServer = useMockStore((state) => state.disconnectServer);
  const connectServer = useMockStore((state) => state.connectServer);

  const activeServer = (targetServerId ? servers.find((s) => s.id === targetServerId) : null) || servers[0];
  const [isReconnecting, setIsReconnecting] = useState(false);

  const isModalOpen = isOpen && type === "connectionDetails";

  const handleReconnect = async () => {
    if (!activeServer || isReconnecting) return;
    setIsReconnecting(true);

    try {
      await connectServer(activeServer.id);
    } catch (err: any) {
      console.error("Reconnection failed:", err);
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleClose = () => {
    onClose("connectionDetails");
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent
        className={cn(
          "overflow-hidden p-0 shadow-2xl",
          isMobile
            ? "border-0 bg-background text-foreground"
            : "max-w-xl rounded-xl border border-zinc-200 bg-white text-black dark:border-zinc-800 dark:bg-[#313338] dark:text-white"
        )}
      >
        <DialogHeader
          className={cn(
            "px-6 pb-2",
            isMobile ? "mobile-safe-top pt-4 text-left" : "pt-6"
          )}
        >
          <DialogTitle
            className={cn(
              "flex items-center gap-x-2 font-bold",
              isMobile ? "text-[28px] tracking-tight" : "text-xl"
            )}
          >
            {!isMobile && <Wifi className="h-5 w-5 text-indigo-500" />}
            Connection details
          </DialogTitle>
          {isMobile && (
            <DialogDescription className="text-left text-[13px] text-muted-foreground">
              IRC, resources, and network status
            </DialogDescription>
          )}
        </DialogHeader>

        <div className={cn("space-y-4 p-6", isMobile && "space-y-3 pb-8")}>
          {/* IRC Status Card */}
          <div
            className={cn(
              "space-y-3 rounded-xl border p-4",
              isMobile
                ? "border-border bg-muted/60"
                : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-[#2b2d31]"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-x-2.5">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500">
                  <Shield className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    IRC server
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    {activeServer?.name} ({activeServer?.host || "127.0.0.1"}:{activeServer?.port || 6667})
                    {activeServer?.useTls && " • TLS"}
                  </p>
                  {activeServer?.username && (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                      Username: {activeServer.username}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-x-2">
                <span
                  className={`inline-flex items-center gap-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${irc
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                    }`}
                >
                  {irc ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {irc ? "Connected" : "Disconnected"}
                </span>

                {irc ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      if (activeServer) {
                        await disconnectServer(activeServer.id);
                      }
                    }}
                    className="h-8 px-2.5 text-xs gap-x-1 border-rose-200 dark:border-rose-900/50 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  >
                    <Unplug className="w-3.5 h-3.5" />
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReconnect}
                    disabled={isReconnecting}
                    className="h-8 px-2.5 text-xs gap-x-1"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isReconnecting ? "animate-spin" : ""}`} />
                    {isReconnecting ? "Connecting..." : "Connect"}
                  </Button>
                )}
              </div>
            </div>

            {/* Connection Error Banner */}
            {!irc && ircError && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs space-y-1">
                <div className="font-semibold flex items-center gap-x-1.5">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Connection error details
                </div>
                <p className="font-mono text-[11px] break-all opacity-90 pl-5">
                  {ircError}
                </p>
              </div>
            )}
          </div>

          {/* Secondary Services (Resource Server & Internet) */}
          <div className="grid grid-cols-2 gap-3">
            {/* Resource Server Card */}
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#2b2d31] flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                  Resource server
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 capitalize">
                  {uploadConfig.provider}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${resourceServer
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}
              >
                {resourceServer ? "Connected" : "Disabled"}
              </span>
            </div>

            {/* Internet Status Card */}
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#2b2d31] flex items-center justify-between">
              <div className="flex items-center gap-x-2">
                <Globe className="w-4 h-4 text-zinc-500" />
                <div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Internet
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    {internet ? "Browser online" : "Offline"}
                  </p>
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${internet
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                  }`}
              >
                {internet ? "Online" : "Offline"}
              </span>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "flex border-t p-4",
            isMobile
              ? "mobile-safe-bottom justify-stretch border-border bg-background"
              : "justify-end border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-[#2b2d31]"
          )}
        >
          <Button
            onClick={handleClose}
            variant="secondary"
            className={cn("px-5", isMobile && "h-11 w-full rounded-full")}
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
