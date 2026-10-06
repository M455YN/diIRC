import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Sliders, AlertCircle, Loader2, KeyRound, ShieldCheck, Trash2, UserPlus } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useMockStore } from "@/lib/mock-store";
import { inviteUserToChannel } from "@/lib/irc-actions";
import { useIsMobileShell } from "@/hooks/use-mobile-platform";
import { MobileChannelOperatorView } from "@/components/mobile/mobile-motd-operator-views";

export interface FlagConfig {
  flag: string;
  label: string;
  description: string;
  tip?: string;
}

export const CHANNEL_FLAGS: FlagConfig[] = [
  {
    flag: "i",
    label: "Invite only (+i)",
    description: "Only invited users can join this channel",
  },
  {
    flag: "m",
    label: "Moderated (+m)",
    description: "Only channel operators and voiced users can speak",
  },
  {
    flag: "n",
    label: "No external messages (+n)",
    description: "Prevent users outside the channel from sending messages",
  },
  {
    flag: "t",
    label: "Topic protection (+t)",
    description: "Only channel operators can change the channel topic",
  },
  {
    flag: "p",
    label: "Private channel (+p)",
    description: "Hides channel from public channel listings",
    tip: "Many IRC servers do not support private channel (+p). Try using secret channel (+s) instead.",
  },
  {
    flag: "s",
    label: "Secret channel (+s)",
    description: "Hides channel from public listings and query commands",
  },
  {
    flag: "a",
    label: "Anonymous channel (+a)",
    description: "Hides user nicknames in channel messages",
    tip: "Anonymous channel (+a) is not supported by all IRC servers.",
  },
];

export const ChannelOperatorSettingsModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const isMobile = useIsMobileShell();
  const channelModesMap = useMockStore((state) => state.channelModes);
  const updateChannelModes = useMockStore((state) => state.updateChannelModes);
  const updateChannelKey = useMockStore((state) => state.updateChannelKey);

  const isModalOpen = isOpen && type === "channelOperatorSettings";
  const { server, channel } = data;

  const [togglingFlags, setTogglingFlags] = useState<Record<string, boolean>>({});
  const [password, setPassword] = useState("");
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [inviteNickname, setInviteNickname] = useState("");
  const [isInviteLoading, setIsInviteLoading] = useState(false);
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState<string | null>(null);

  const activeFlags = new Set(channel ? channelModesMap[channel.id] || [] : []);
  const hasExistingKey = !!channel?.key;

  useEffect(() => {
    if (isModalOpen && server?.id && channel?.name) {
      setErrorMessage(null);
      setTogglingFlags({});
      setPassword(channel.key || "");
      setIsPasswordLoading(false);
      setInviteNickname("");
      setIsInviteLoading(false);
      setInviteSuccessMessage(null);

      // Query current channel modes from IRC server
      const chanTarget = channel.name.startsWith("#") ? channel.name : `#${channel.name}`;
      invoke("send_mode", {
        serverId: server.id,
        target: chanTarget,
        mode: null,
        params: null,
      }).catch((err) => {
        console.error("Failed to query channel mode:", err);
      });
    }
  }, [isModalOpen, server?.id, channel?.name, channel?.key]);

  const handleClose = () => {
    setErrorMessage(null);
    setTogglingFlags({});
    setPassword("");
    setIsPasswordLoading(false);
    setInviteNickname("");
    setIsInviteLoading(false);
    setInviteSuccessMessage(null);
    onClose("channelOperatorSettings");
  };

  const handleToggleFlag = async (flag: string, enable: boolean) => {
    if (!server?.id || !channel?.name || !channel?.id) return;

    try {
      setTogglingFlags((prev) => ({ ...prev, [flag]: true }));
      setErrorMessage(null);

      // Clear any previous error overlay before sending new mode command
      if (useModal.getState().errorData) {
        useModal.getState().onClose("ircError");
      }

      const chanTarget = channel.name.startsWith("#") ? channel.name : `#${channel.name}`;
      const modeCmd = `${enable ? "+" : "-"}${flag}`;

      await invoke("send_mode", {
        serverId: server.id,
        target: chanTarget,
        mode: modeCmd,
        params: null,
      });

      // Wait briefly for server response (RPL_CHANNELMODEIS / MODE / error)
      await new Promise((res) => setTimeout(res, 400));

      // If an explicit server error modal was already triggered, do not trigger fallback modal
      const activeErrorData = useModal.getState().errorData;
      const isErrorOpen = useModal.getState().isOpen && useModal.getState().type === "ircError";
      if (activeErrorData !== null || isErrorOpen) {
        return;
      }

      const updatedModes = useMockStore.getState().channelModes[channel.id] || [];
      const isNowActive = updatedModes.includes(flag);

      if (enable && !isNowActive) {
        useModal.getState().onOpen("ircError", {
          title: "Channel mode not set",
          description: `The IRC server did not set mode +${flag} on ${chanTarget}. This mode flag may require additional parameters or may not be supported by this server.`,
          flag,
        });
      } else if (!enable && isNowActive) {
        useModal.getState().onOpen("ircError", {
          title: "Channel mode not removed",
          description: `The IRC server did not remove mode -${flag} on ${chanTarget}.`,
          flag,
        });
      }
    } catch (err: any) {
      console.error(`Failed to toggle flag ${flag}:`, err);
      const errText = err?.toString() || "Failed to update channel mode. Make sure you are channel operator.";
      setErrorMessage(errText);
      useModal.getState().onOpen("ircError", {
        title: "Channel mode error",
        description: `Failed to set flag ${enable ? "+" : "-"}${flag}: ${errText}`,
        flag,
      });
    } finally {
      setTogglingFlags((prev) => ({ ...prev, [flag]: false }));
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!server?.id || !channel?.id || !password.trim()) return;

    try {
      setIsPasswordLoading(true);
      setErrorMessage(null);

      const trimmedKey = password.trim();

      await invoke("set_channel_key", {
        serverId: server.id,
        channel: channel.name,
        key: trimmedKey,
      });

      updateChannelKey(server.id, channel.id, trimmedKey);
    } catch (err: any) {
      console.error("Failed to set channel password:", err);
      const errText = err?.toString() || "Failed to set password. Make sure you are channel operator.";
      setErrorMessage(errText);
      useModal.getState().onOpen("ircError", {
        title: "Channel mode error",
        description: errText,
      });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleRemovePassword = async () => {
    if (!server?.id || !channel?.id) return;

    try {
      setIsPasswordLoading(true);
      setErrorMessage(null);

      await invoke("set_channel_key", {
        serverId: server.id,
        channel: channel.name,
        key: null,
      });

      updateChannelKey(server.id, channel.id, undefined);
      setPassword("");
    } catch (err: any) {
      console.error("Failed to remove channel password:", err);
      const errText = err?.toString() || "Failed to remove password. Make sure you are channel operator.";
      setErrorMessage(errText);
      useModal.getState().onOpen("ircError", {
        title: "Channel mode error",
        description: errText,
      });
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!server?.id || !channel?.name || !inviteNickname.trim()) return;

    try {
      setIsInviteLoading(true);
      setInviteSuccessMessage(null);
      setErrorMessage(null);

      const targetNick = inviteNickname.trim();
      await inviteUserToChannel(server.id, targetNick, channel.name);

      setInviteSuccessMessage(`Invite sent to ${targetNick}`);
      setInviteNickname("");
    } catch (err: any) {
      console.error("Failed to send invite from settings modal:", err);
      setErrorMessage(err?.toString() || "Failed to send invite.");
    } finally {
      setIsInviteLoading(false);
    }
  };

  if (isMobile) {
    const noopEvent = { preventDefault: () => {} } as React.FormEvent;
    return (
      <MobileChannelOperatorView
        open={isModalOpen}
        onClose={handleClose}
        channelName={channel?.name?.replace(/^#/, "") ?? ""}
        errorMessage={errorMessage}
        hasKey={hasExistingKey}
        password={password}
        setPassword={setPassword}
        passwordBusy={isPasswordLoading}
        onSetPassword={() => handleSetPassword(noopEvent)}
        onRemovePassword={handleRemovePassword}
        flags={CHANNEL_FLAGS}
        activeFlags={activeFlags}
        togglingFlags={togglingFlags}
        onToggleFlag={handleToggleFlag}
        inviteNickname={inviteNickname}
        setInviteNickname={(v) => {
          setInviteNickname(v);
          if (inviteSuccessMessage) setInviteSuccessMessage(null);
        }}
        inviteBusy={isInviteLoading}
        inviteSuccess={inviteSuccessMessage}
        onSendInvite={() => handleSendInvite(noopEvent)}
      />
    );
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="bg-white dark:bg-[#313338] text-black dark:text-white p-0 overflow-hidden sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="pt-6 px-6 shrink-0">
          <DialogTitle className="text-xl text-center font-bold flex items-center justify-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-500" />
            Channel settings (operator)
          </DialogTitle>
          <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Manage channel flags and password for <span className="font-semibold text-indigo-500">#{channel?.name}</span>
          </p>
        </DialogHeader>

        <div className="px-6 py-2 flex-1 min-h-0 overflow-y-auto space-y-4 custom-scrollbar">
          {errorMessage && (
            <div className="flex items-center gap-x-2 text-red-500 bg-red-500/10 p-3 rounded-md border border-red-500/20 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section: Channel password */}
          <div className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-x-2">
                <KeyRound className="w-4 h-4 text-indigo-500" />
                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Channel password (+k)
                </span>
              </div>
              {hasExistingKey && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20 flex items-center gap-x-1">
                  <ShieldCheck className="w-3 h-3" />
                  Protected
                </span>
              )}
            </div>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Set a password required to join this channel or remove existing protection.
            </p>

            <form onSubmit={handleSetPassword} className="space-y-3 pt-1">
              <div className="flex gap-x-2">
                <Input
                  disabled={isPasswordLoading}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={hasExistingKey ? "Enter new password..." : "Enter password..."}
                  className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 focus-visible:ring-1 focus-visible:ring-indigo-500 text-black dark:text-white text-xs h-9"
                />
                <Button
                  type="submit"
                  disabled={isPasswordLoading || !password.trim()}
                  size="sm"
                  className="bg-indigo-500 hover:bg-indigo-600 text-white shrink-0 h-9 text-xs"
                >
                  {isPasswordLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Set password"
                  )}
                </Button>
              </div>

              {hasExistingKey && (
                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleRemovePassword}
                    disabled={isPasswordLoading}
                    className="h-8 text-xs gap-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove password
                  </Button>
                </div>
              )}
            </form>
          </div>

          {/* Section: Channel flags */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 px-1">
              Channel flags
            </h4>
            <div className="space-y-2">
              {CHANNEL_FLAGS.map(({ flag, label, description }) => {
                const isChecked = activeFlags.has(flag);
                const isToggling = !!togglingFlags[flag];

                return (
                  <div
                    key={flag}
                    className="flex flex-col p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700/50 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition"
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5 max-w-[78%]">
                        <div className="flex items-center gap-x-2">
                          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                            {label}
                          </span>
                          {isChecked && (
                            <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">
                          {description}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {isToggling ? (
                          <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                        ) : (
                          <Switch
                            checked={isChecked}
                            onCheckedChange={(checked) => handleToggleFlag(flag, checked)}
                          />
                        )}
                      </div>
                    </div>

                    {flag === "i" && isChecked && (
                      <div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700/60 space-y-2">
                        <div className="flex items-center gap-x-2">
                          <UserPlus className="w-3.5 h-3.5 text-indigo-500" />
                          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                            Invite user to channel
                          </span>
                        </div>
                        <form onSubmit={handleSendInvite} className="flex gap-x-2">
                          <Input
                            disabled={isInviteLoading}
                            type="text"
                            value={inviteNickname}
                            onChange={(e) => {
                              setInviteNickname(e.target.value);
                              if (inviteSuccessMessage) setInviteSuccessMessage(null);
                            }}
                            placeholder="Enter nickname..."
                            className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 focus-visible:ring-1 focus-visible:ring-indigo-500 text-black dark:text-white text-xs h-9"
                          />
                          <Button
                            type="submit"
                            disabled={isInviteLoading || !inviteNickname.trim()}
                            size="sm"
                            className="bg-indigo-500 hover:bg-indigo-600 text-white shrink-0 h-9 text-xs gap-x-1"
                          >
                            {isInviteLoading ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <>
                                <UserPlus className="w-3.5 h-3.5" />
                                Send invite
                              </>
                            )}
                          </Button>
                        </form>
                        {inviteSuccessMessage && (
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                            {inviteSuccessMessage}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="bg-zinc-100 dark:bg-zinc-800/40 px-6 py-3 flex justify-end shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="text-xs"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
