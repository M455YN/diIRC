import { useState, useEffect } from "react";
import { Settings } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { Button } from "@/components/ui/button";
import { useMockStore } from "@/lib/mock-store";
import { useIsMobileShell } from "@/hooks/use-mobile-platform";
import { MobileChannelSettingsModal } from "@/components/mobile/mobile-channel-modals";
import { NotificationOverrideValue, SoundPreset, ChannelNotificationOverrideValue, DmNotificationOverrideValue } from "@/types";
import { resolveEffectiveNotificationSettings } from "@/lib/notification-service";
import { NotificationSettingsFields } from "@/components/notifications/notification-settings-fields";

export const ChannelSettingsModal = () =>
  useIsMobileShell() ? <MobileChannelSettingsModal /> : <DesktopChannelSettingsModal />;

const DesktopChannelSettingsModal = () => {
  const { isOpen, onClose, type, data } = useModal();

  const setChannelNotificationSettings = useMockStore((state) => state.setChannelNotificationSettings);
  const setConversationNotificationSettings = useMockStore((state) => state.setConversationNotificationSettings);
  const globalNotificationSettings = useMockStore((state) => state.notificationSettings);

  const isModalOpen = isOpen && type === "channelSettings";
  const { channel, server, conversationId } = data;

  // Retrieve current server & channel or conversation state
  const currentServer = useMockStore((state) =>
    state.servers.find((s) => s.id === (server?.id || channel?.serverId))
  ) || server;

  const currentChannel = currentServer?.channels.find((c) => c.id === channel?.id) || channel;
  const conversationOverrides = useMockStore((state) =>
    conversationId ? state.conversationNotificationSettings[conversationId] : undefined
  );

  const targetOverrides = currentChannel
    ? currentChannel.notificationSettings
    : conversationOverrides;

  const [channelNotificationsOverride, setChannelNotificationsOverride] = useState<ChannelNotificationOverrideValue>("default");
  const [dmNotificationsOverride, setDmNotificationsOverride] = useState<DmNotificationOverrideValue>("default");
  const [soundOverride, setSoundOverride] = useState<NotificationOverrideValue>("default");
  const [popupOverride, setPopupOverride] = useState<NotificationOverrideValue>("default");
  const [taskbarOverride, setTaskbarOverride] = useState<NotificationOverrideValue>("default");
  const [soundCooldownOverride, setSoundCooldownOverride] = useState<"default" | number>("default");
  const [soundPresetOverride, setSoundPresetOverride] = useState<"default" | SoundPreset>("default");
  const [customSoundUrlOverride, setCustomSoundUrlOverride] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (isModalOpen) {
      setChannelNotificationsOverride(targetOverrides?.channelNotifications || "default");
      setDmNotificationsOverride(targetOverrides?.dmNotifications || "default");
      setSoundOverride(targetOverrides?.sound || "default");
      setPopupOverride(targetOverrides?.popup || "default");
      setTaskbarOverride(targetOverrides?.taskbar || "default");
      setSoundCooldownOverride(targetOverrides?.soundCooldown ?? "default");
      setSoundPresetOverride(targetOverrides?.soundPreset || "default");
      setCustomSoundUrlOverride(targetOverrides?.customSoundUrl);
    }
  }, [isModalOpen, targetOverrides]);

  const handleClose = () => {
    onClose("channelSettings");
  };

  const handleSave = () => {
    const updated = {
      channelNotifications: channelNotificationsOverride,
      dmNotifications: dmNotificationsOverride,
      sound: soundOverride,
      popup: popupOverride,
      taskbar: taskbarOverride,
      soundCooldown: soundCooldownOverride,
      soundPreset: soundPresetOverride,
      customSoundUrl: customSoundUrlOverride,
    };

    if (currentServer && currentChannel) {
      setChannelNotificationSettings(currentServer.id, currentChannel.id, updated);
    } else if (conversationId) {
      setConversationNotificationSettings(conversationId, updated);
    }

    handleClose();
  };

  const isDm = Boolean(conversationId);

  // Calculate parent's effective inherited settings for default labels
  const parentEffective = resolveEffectiveNotificationSettings(
    globalNotificationSettings,
    currentServer?.notificationSettings,
    undefined,
    isDm
  );

  const parentChannelNotificationsStr =
    parentEffective.channelNotifications === "all"
      ? "All messages"
      : parentEffective.channelNotifications === "off"
      ? "Disabled"
      : "Mentions only";
  const parentDmNotificationsStr = parentEffective.dmNotifications === "off" ? "Disabled" : "Enabled";
  const parentSoundStr = parentEffective.sound ? "Enabled" : "Muted";
  const parentPopupStr = parentEffective.popup ? "Enabled" : "Off";
  const parentTaskbarStr = parentEffective.taskbar ? "Enabled" : "Off";
  const parentCooldownSec = (parentEffective.soundCooldownMs / 1000).toFixed(1);
  const parentSoundPresetStr = parentEffective.soundPreset;

  const targetMember = isDm && currentServer && conversationId
    ? currentServer.members.find((m) => conversationId.includes(m.id))
    : undefined;

  const targetName = currentChannel
    ? `#${currentChannel.name}`
    : targetMember
    ? `@${targetMember.profile.name}`
    : conversationId
    ? "Private Conversation"
    : "Channel";

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden sm:max-w-lg max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl">
        <DialogHeader className="pt-6 px-6 space-y-1 shrink-0">
          <DialogTitle className="text-xl text-center font-bold flex items-center justify-center gap-x-2 text-zinc-900 dark:text-zinc-100">
            <Settings className="w-5 h-5 text-indigo-500" />
            {isDm ? "Private Conversation Settings" : "Channel Settings"}
          </DialogTitle>
          <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
            Notification preferences for <span className="font-semibold text-indigo-600 dark:text-indigo-400">{targetName}</span>
          </p>
        </DialogHeader>

        <div className="px-6 py-4 flex-1 min-h-0 overflow-y-auto">
          <NotificationSettingsFields
            mode={isDm ? "dm" : "channel"}
            values={{
              channelNotifications: channelNotificationsOverride,
              dmNotifications: dmNotificationsOverride,
              sound: soundOverride,
              soundPreset: soundPresetOverride,
              customSoundUrl: customSoundUrlOverride,
              soundCooldown: soundCooldownOverride,
              popup: popupOverride,
              taskbar: taskbarOverride,
            }}
            inherited={{
              channelNotificationsStr: parentChannelNotificationsStr,
              dmNotificationsStr: parentDmNotificationsStr,
              soundStr: parentSoundStr,
              soundPresetStr: parentSoundPresetStr,
              cooldownSec: parentCooldownSec,
              popupStr: parentPopupStr,
              taskbarStr: parentTaskbarStr,
            }}
            onChange={(field, val) => {
              if (field === "channelNotifications") setChannelNotificationsOverride(val);
              else if (field === "dmNotifications") setDmNotificationsOverride(val);
              else if (field === "sound") setSoundOverride(val);
              else if (field === "soundPreset") setSoundPresetOverride(val);
              else if (field === "customSoundUrl") setCustomSoundUrlOverride(val);
              else if (field === "soundCooldown") setSoundCooldownOverride(val);
              else if (field === "popup") setPopupOverride(val);
              else if (field === "taskbar") setTaskbarOverride(val);
            }}
          />
        </div>

        <div className="bg-zinc-100/90 dark:bg-[#2b2d31] border-t border-zinc-200 dark:border-zinc-800/80 px-6 py-4 flex items-center justify-between shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-5 py-2 rounded-lg transition shadow-md hover:shadow-indigo-500/20"
          >
            Save changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
