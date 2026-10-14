import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Lock, AlertCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { listen, UnlistenFn } from "@tauri-apps/api/event";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMockStore } from "@/lib/mock-store";
import { ChannelType } from "@/types";

export const JoinChannelPasswordModal = () => {
  const { t } = useTranslation();
  const { isOpen, onClose, type, data } = useModal();
  const navigate = useNavigate();
  const addChannel = useMockStore((state) => state.addChannel);
  const servers = useMockStore((state) => state.servers);

  const isModalOpen = isOpen && type === "joinChannelPassword";
  const { serverId, channelName, errorMessage } = data;

  const inputRef = useRef<HTMLInputElement>(null);
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (isModalOpen) {
      setPassword("");
      setIsLoading(false);
      // Only show error if they've explicitly failed a password attempt, 
      // not on the initial prompt where the server just says "Cannot join (+k)"
      const isInitialPrompt = errorMessage?.includes("Cannot join channel");
      setLocalError(isInitialPrompt ? null : errorMessage || null);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [isModalOpen, errorMessage]);

  useEffect(() => {
    if (localError) {
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [localError]);

  const activeServerId = serverId || servers[0]?.id;
  const cleanChan = (channelName || "").replace(/^#/, "");

  const handleClose = () => {
    setPassword("");
    setIsLoading(false);
    setLocalError(null);
    onClose("joinChannelPassword");
  };

  useEffect(() => {
    let unlistenUsers: UnlistenFn | null = null;
    let unlistenBadKey: UnlistenFn | null = null;
    let isCancelled = false;

    if (isModalOpen) {
      listen<any>("irc_user_event", (event) => {
        if (isCancelled) return;
        const { server_id, channel, users, event_type } = event.payload;
        if (event_type === "JOIN" && server_id === activeServerId) {
          const eventCleanChan = channel.replace(/^#/, "");
          if (eventCleanChan.toLowerCase() === cleanChan.toLowerCase()) {
            console.log("We joined! Adding channel and navigating...");
            const store = useMockStore.getState();
            const newChan = store.addChannel(activeServerId, cleanChan, ChannelType.TEXT);
            if (password.trim()) {
              store.updateChannelKey(activeServerId, newChan.id, password.trim());
            }
            setIsLoading(false);
            onClose("joinChannelPassword");
            if (newChan?.id) {
              navigate(`/servers/${activeServerId}/channels/${newChan.id}`);
            }
          }
        }
      }).then((unlisten) => {
        if (isCancelled) unlisten();
        else unlistenUsers = unlisten;
      });

      listen<any>("irc_bad_channel_key", (event) => {
        if (isCancelled) return;
        const { server_id, channel, error } = event.payload;
        if (server_id === activeServerId) {
          const eventCleanChan = channel.replace(/^#/, "");
          if (eventCleanChan.toLowerCase() === cleanChan.toLowerCase()) {
            // Received a bad key event while modal is open.
            // If we are loading, it means our submit failed.
            setIsLoading(false);
            setLocalError("Incorrect password.");
          }
        }
      }).then((unlisten) => {
        if (isCancelled) unlisten();
        else unlistenBadKey = unlisten;
      });
    }

    return () => {
      isCancelled = true;
      if (unlistenUsers) unlistenUsers();
      if (unlistenBadKey) unlistenBadKey();
    };
  }, [isModalOpen, activeServerId, cleanChan, navigate, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeServerId || !cleanChan || !password.trim()) return;

    try {
      setIsLoading(true);
      setLocalError(null);

      useMockStore.getState().setPendingJoin(activeServerId, cleanChan, password.trim());

      await invoke("join_channel", {
        serverId: activeServerId,
        channel: cleanChan,
        password: password.trim(),
      });

      // Do not navigate or close yet. We wait for either:
      // 1. A JOIN event (success) which will be handled by the useEffect.
      // 2. An irc_bad_channel_key event (failure) which will be handled by irc-provider re-opening this modal with an error.
    } catch (err: any) {
      console.error("Failed to join password-protected channel:", err);
      setIsLoading(false);
      setLocalError(err?.toString() || t("join.failed"));
    }
  };


  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white p-0 overflow-hidden sm:max-w-md">
        <DialogHeader className="pt-8 px-6">
          <DialogTitle className="text-2xl text-center font-bold flex items-center justify-center gap-2">
            <Lock className="w-6 h-6 text-indigo-500" />
            {t("join.protected")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-2">
          <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
            The channel <span className="font-semibold text-indigo-500">#{cleanChan}</span> requires a password to join.
          </p>

          {localError && (
            <div className="flex items-center gap-x-2 text-red-500 bg-red-500/10 p-3 rounded-md border border-red-500/20 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{localError}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="uppercase text-xs font-bold text-zinc-500 dark:text-zinc-400">
              {t("join.channelPassword")}
            </label>
            <Input
              ref={inputRef}
              disabled={isLoading}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("join.placeholder")}
              className="bg-zinc-300/50 dark:bg-zinc-700/50 border-0 focus-visible:ring-1 focus-visible:ring-offset-0 text-black dark:text-white"
              autoFocus
            />
          </div>

          <DialogFooter className="pt-4 pb-4">
            <Button
              type="button"
              variant="ghost"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="bg-indigo-500 hover:bg-indigo-600 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("join.joining")}
                </>
              ) : (
                "Join channel"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
