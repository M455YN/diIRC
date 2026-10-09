import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import Box from "@mui/material/Box";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";
import { resolveEffectiveNotificationSettings } from "@/lib/notification-service";
import { ChannelType } from "@/types";
import type { NotificationSettingsValues } from "@/components/notifications/notification-settings-fields";
import { MobileNotificationOverrides } from "@/components/mobile/mobile-notification-overrides";
import {
  M3FullScreenDialog,
  M3ListGroup,
  M3SwitchItem,
  M3TextField,
  useM3,
  useM3Picker,
} from "@/components/mobile/m3";

/** Join channel — Material 3 full-screen dialog. */
export const MobileCreateChannelModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const navigate = useNavigate();
  const params = useParams();
  const servers = useMockStore((s) => s.servers);
  const addChannel = useMockStore((s) => s.addChannel);
  const open = isOpen && type === "createChannel";
  const serverId = params?.serverId || data?.server?.id || servers[0]?.id;

  const [name, setName] = useState("");
  const [temporary, setTemporary] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setTemporary(false);
      setError(undefined);
      setBusy(false);
    }
  }, [open]);

  const close = () => onClose("createChannel");

  const join = async () => {
    const clean = name.trim().replace(/^#/, "");
    if (!clean) {
      setError("Channel name is required.");
      return;
    }
    if (!serverId || busy) return;
    setBusy(true);
    try {
      useMockStore.getState().setPendingJoin(serverId, clean, undefined);
      const channel = addChannel(serverId, clean, ChannelType.TEXT, temporary);
      await invoke("join_channel", { serverId, channel: clean, password: null });
      if (channel?.id) navigate(`/servers/${serverId}/channels/${channel.id}`);
    } catch (e) {
      console.error("Failed to join channel on IRC:", e);
    } finally {
      close();
    }
  };

  return (
    <M3FullScreenDialog
      open={open}
      title="Join channel"
      onClose={close}
      action={{ label: "Join", onClick: join, disabled: busy || !name.trim() }}
    >
      <Box sx={{ px: 0.5, pt: 2, pb: 3 }}>
        <M3TextField
          label="Channel name"
          prefix="#"
          value={name}
          autoFocus
          onChange={(v) => {
            setName(v.replace(/^#/, ""));
            setError(undefined);
          }}
          placeholder="general"
          error={error}
        />
      </Box>
      <M3ListGroup>
        <M3SwitchItem
          title="Join temporarily"
          supporting="Don't rejoin automatically after restarting the app"
          checked={temporary}
          onChange={setTemporary}
          divider={false}
        />
      </M3ListGroup>
    </M3FullScreenDialog>
  );
};

const TargetIntro = ({ name }: { name: string }) => {
  const t = useM3();
  return (
    <Box sx={{ px: 0.5, pt: 1, fontSize: "0.875rem", lineHeight: "20px", color: t.onSurfaceVariant }}>
      Notification preferences for{" "}
      <Box component="span" sx={{ color: t.primary, fontWeight: 500 }}>
        {name}
      </Box>
    </Box>
  );
};

/** Channel / conversation notification overrides — Material 3 full-screen dialog. */
export const MobileChannelSettingsModal = () => {
  const { isOpen, onClose, type, data } = useModal();
  const open = isOpen && type === "channelSettings";
  const { channel, server, conversationId } = data;

  const setChannelNotificationSettings = useMockStore((s) => s.setChannelNotificationSettings);
  const setConversationNotificationSettings = useMockStore(
    (s) => s.setConversationNotificationSettings
  );
  const globalNotificationSettings = useMockStore((s) => s.notificationSettings);
  const currentServer =
    useMockStore((s) => s.servers.find((sv) => sv.id === (server?.id || channel?.serverId))) ||
    server;
  const currentChannel = currentServer?.channels.find((c) => c.id === channel?.id) || channel;
  const conversationOverrides = useMockStore((s) =>
    conversationId ? s.conversationNotificationSettings[conversationId] : undefined
  );
  const overrides = currentChannel ? currentChannel.notificationSettings : conversationOverrides;

  const picker = useM3Picker();
  const [values, setValues] = useState<NotificationSettingsValues>({});

  useEffect(() => {
    if (!open) return;
    setValues({
      channelNotifications: overrides?.channelNotifications || "default",
      dmNotifications: overrides?.dmNotifications || "default",
      sound: overrides?.sound || "default",
      popup: overrides?.popup || "default",
      taskbar: overrides?.taskbar || "default",
      soundCooldown: overrides?.soundCooldown ?? "default",
      soundPreset: overrides?.soundPreset || "default",
      customSoundUrl: overrides?.customSoundUrl,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isDm = Boolean(conversationId);
  const parent = resolveEffectiveNotificationSettings(
    globalNotificationSettings,
    currentServer?.notificationSettings,
    undefined,
    isDm
  );

  const member =
    isDm && currentServer && conversationId
      ? currentServer.members.find((m) => conversationId.includes(m.id))
      : undefined;
  const targetName = currentChannel
    ? `#${currentChannel.name}`
    : member
      ? `@${member.profile.name}`
      : "Private conversation";

  const close = () => onClose("channelSettings");
  const back = () => (picker.isOpen ? picker.close() : close());

  const save = () => {
    const updated = values as any;
    if (currentServer && currentChannel) {
      setChannelNotificationSettings(currentServer.id, currentChannel.id, updated);
    } else if (conversationId) {
      setConversationNotificationSettings(conversationId, updated);
    }
    close();
  };

  return (
    <M3FullScreenDialog
      open={open}
      title={isDm ? "Conversation settings" : "Channel settings"}
      onClose={back}
      action={{ label: "Save", onClick: save }}
    >
      <TargetIntro name={targetName} />
      <MobileNotificationOverrides
        mode={isDm ? "dm" : "channel"}
        values={values}
        inherited={{
          channelNotifications:
            parent.channelNotifications === "all"
              ? "All messages"
              : parent.channelNotifications === "off"
                ? "Off"
                : "Mentions only",
          dmNotifications: parent.dmNotifications === "off" ? "Off" : "All messages",
          sound: parent.sound ? "On" : "Muted",
          soundPreset: parent.soundPreset,
          cooldownSec: (parent.soundCooldownMs / 1000).toString(),
          popup: parent.popup ? "On" : "Off",
        }}
        onChange={(field, value) => setValues((v) => ({ ...v, [field]: value }))}
        openPicker={picker.open}
      />
      {picker.element}
    </M3FullScreenDialog>
  );
};
