import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { ShieldAlert } from "lucide-react";

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
import { useMockStore, getServerActiveNick } from "@/lib/mock-store";

export const EditTopicModal = () => {
  const { t: tr } = useTranslation();
  const { isOpen, onClose, type, data } = useModal();
  const ircConnectedServers = useMockStore((state) => state.ircConnectedServers);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const channelOpsMap = useMockStore((state) => state.channelOps);
  const channelUserModesMap = useMockStore((state) => state.channelUserModes);
  const channelModesMap = useMockStore((state) => state.channelModes);

  const isModalOpen = isOpen && type === "editTopic";
  const { server, channel } = data;

  const [topic, setTopic] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isConnected = !!(server?.id && ircConnectedServers[server.id]);

  // Permission check: the server decides, we only mirror the rule. +t = operators only; otherwise anyone.
  const ourNick = server ? getServerActiveNick(server) : currentProfile.name;
  const isServerOwner = server?.profileId === currentProfile.id;
  const isChannelOwner = channel?.profileId === currentProfile.id;

  const channelOps = channel?.id ? channelOpsMap[channel.id] || [] : [];
  const ourModes = channel?.id ? channelUserModesMap[channel.id]?.[ourNick.toLowerCase()] || [] : [];
  const isChannelOp =
    channelOps.some((opNick) => opNick.toLowerCase() === ourNick.toLowerCase()) ||
    ourModes.some((m) => ["o", "a", "q"].includes(m.toLowerCase()));

  // Topic lock (+t). Unknown modes are not treated as locked, so the server gets the final say.
  const channelFlags = channel?.id ? channelModesMap[channel.id] || [] : [];
  const topicLocked = channelFlags.some((f) => f.toLowerCase() === "t");
  const canEditTopic = isConnected && (!topicLocked || isChannelOp);

  useEffect(() => {
    if (channel) {
      setTopic(channel.topic || "");
      setErrorMessage(null);
    }
  }, [channel, isOpen]);

  const handleClose = () => {
    onClose("editTopic");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!server?.id || !channel?.id || !canEditTopic) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);

      // Only sent over a live connection; the server broadcasts TOPIC/RPL_TOPIC on success.
      await invoke("set_channel_topic", {
        serverId: server.id,
        channel: channel.name,
        topic: topic,
      });

      handleClose();
    } catch (error: any) {
      console.error("Failed to update channel topic:", error);
      const errText = typeof error === "string" 
        ? error 
        : error?.message || tr("topic.failedPermissions");
      setErrorMessage(errText);
      useModal.getState().onOpen("ircError", {
        title: tr("topic.failedTitle"),
        description: errText,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden max-w-md border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl">
        <DialogHeader className="pt-6 px-6 space-y-2">
          <DialogTitle className="text-2xl text-center font-bold text-zinc-900 dark:text-zinc-100">
            {tr("topic.edit")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="px-6 py-2 space-y-3">
            {!isConnected && (
              <div className="flex items-start gap-x-2 p-3 rounded-lg bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 text-xs border border-zinc-500/20">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{tr("topic.offline")}</span>
              </div>
            )}
            {isConnected && !canEditTopic && (
              <div className="flex items-start gap-x-2 p-3 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs border border-amber-500/20">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{tr("topic.locked")}</span>
              </div>
            )}

            {errorMessage && (
              <div className="flex items-start gap-x-2 p-3 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs border border-rose-500/20">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div>
              <label className="uppercase text-xs font-bold text-zinc-500 dark:text-zinc-400">
                {tr("topic.forChannel", { name: channel?.name })}
              </label>
              <Input
                disabled={isLoading || !canEditTopic}
                className="bg-zinc-100 dark:bg-zinc-800/60 border-0 focus-visible:ring-1 focus-visible:ring-indigo-500 text-zinc-800 dark:text-zinc-100 mt-2"
                placeholder={tr("topic.placeholder")}
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="bg-zinc-100/90 dark:bg-[#2b2d31] border-t border-zinc-200 dark:border-zinc-800/80 px-6 py-4 flex items-center justify-between">
            <Button
              type="button"
              disabled={isLoading}
              onClick={handleClose}
              variant="ghost"
              className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
            >
              {tr("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !canEditTopic}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 shadow-sm"
            >
              {tr("topic.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
