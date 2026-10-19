import i18n from "@/lib/i18n";
import { SoundPreset, playNotificationSound } from "./notification-sound";
import {
  NotificationOverride,
  GlobalNotificationSettings,
  ChannelNotificationMode,
  DmNotificationMode,
} from "@/types";
import { invoke } from "@tauri-apps/api/core";
import {
  isPermissionGranted as tauriIsPermissionGranted,
  requestPermission as tauriRequestPermission,
  sendNotification as tauriSendNotification,
} from "@tauri-apps/plugin-notification";

export function resolveEffectiveNotificationSettings(
  global: GlobalNotificationSettings,
  serverOverride?: NotificationOverride,
  channelOverride?: NotificationOverride,
  isDm: boolean = false
): {
  sound: boolean;
  popup: boolean;
  taskbar: boolean;
  soundCooldownMs: number;
  soundPreset: SoundPreset;
  customSoundUrl?: string;
  channelNotifications: ChannelNotificationMode;
  dmNotifications: DmNotificationMode;
  shouldNotify: (hasMention?: boolean) => boolean;
} {
  const globalDefaults: GlobalNotificationSettings = {
    soundEnabled: global?.soundEnabled ?? true,
    soundPreset: global?.soundPreset ?? "chime",
    dmSoundPreset: global?.dmSoundPreset ?? "chime",
    soundCooldownMs: global?.soundCooldownMs ?? 3000,
    popupEnabled: global?.popupEnabled ?? true,
    taskbarHighlightEnabled: global?.taskbarHighlightEnabled ?? true,
    channelNotifications: global?.channelNotifications ?? "mentions",
    dmNotifications: global?.dmNotifications ?? "all",
  };

  let channelNotifications: ChannelNotificationMode = globalDefaults.channelNotifications || "mentions";
  if (serverOverride?.channelNotifications && serverOverride.channelNotifications !== "default") {
    channelNotifications = serverOverride.channelNotifications;
  }
  if (channelOverride?.channelNotifications && channelOverride.channelNotifications !== "default") {
    channelNotifications = channelOverride.channelNotifications;
  }

  let dmNotifications: DmNotificationMode = globalDefaults.dmNotifications || "all";
  if (serverOverride?.dmNotifications && serverOverride.dmNotifications !== "default") {
    dmNotifications = serverOverride.dmNotifications;
  }
  if (channelOverride?.dmNotifications && channelOverride.dmNotifications !== "default") {
    dmNotifications = channelOverride.dmNotifications;
  }

  let sound = globalDefaults.soundEnabled;
  if (serverOverride?.sound && serverOverride.sound !== "default") {
    sound = serverOverride.sound === "enabled";
  }
  if (channelOverride?.sound && channelOverride.sound !== "default") {
    sound = channelOverride.sound === "enabled";
  }

  let soundCooldownMs = globalDefaults.soundCooldownMs ?? 3000;
  if (serverOverride?.soundCooldown !== undefined && serverOverride.soundCooldown !== "default") {
    soundCooldownMs = typeof serverOverride.soundCooldown === "number" ? serverOverride.soundCooldown : soundCooldownMs;
  }
  if (channelOverride?.soundCooldown !== undefined && channelOverride.soundCooldown !== "default") {
    soundCooldownMs = typeof channelOverride.soundCooldown === "number" ? channelOverride.soundCooldown : soundCooldownMs;
  }

  let popup = globalDefaults.popupEnabled;
  if (serverOverride?.popup && serverOverride.popup !== "default") {
    popup = serverOverride.popup === "enabled";
  }
  if (channelOverride?.popup && channelOverride.popup !== "default") {
    popup = channelOverride.popup === "enabled";
  }

  let taskbar = globalDefaults.taskbarHighlightEnabled;
  if (serverOverride?.taskbar && serverOverride.taskbar !== "default") {
    taskbar = serverOverride.taskbar === "enabled";
  }
  if (channelOverride?.taskbar && channelOverride.taskbar !== "default") {
    taskbar = channelOverride.taskbar === "enabled";
  }

  // Resolve Sound Preset and Custom Sound URL
  let soundPreset: SoundPreset = isDm
    ? (globalDefaults.dmSoundPreset || globalDefaults.soundPreset)
    : globalDefaults.soundPreset;
  let customSoundUrl: string | undefined = isDm
    ? (global?.customDmSoundUrl || global?.customSoundUrl)
    : global?.customSoundUrl;

  if (isDm) {
    if (serverOverride?.dmSoundPreset && serverOverride.dmSoundPreset !== "default") {
      soundPreset = serverOverride.dmSoundPreset;
      customSoundUrl = serverOverride.customDmSoundUrl;
    }
    if (channelOverride?.soundPreset && channelOverride.soundPreset !== "default") {
      soundPreset = channelOverride.soundPreset;
      customSoundUrl = channelOverride.customSoundUrl;
    }
  } else {
    if (serverOverride?.soundPreset && serverOverride.soundPreset !== "default") {
      soundPreset = serverOverride.soundPreset;
      customSoundUrl = serverOverride.customSoundUrl;
    }
    if (channelOverride?.soundPreset && channelOverride.soundPreset !== "default") {
      soundPreset = channelOverride.soundPreset;
      customSoundUrl = channelOverride.customSoundUrl;
    }
  }

  const shouldNotify = (hasMention: boolean = false): boolean => {
    if (isDm) {
      return dmNotifications !== "off";
    }
    if (channelNotifications === "off") {
      return false;
    }
    if (channelNotifications === "mentions") {
      return hasMention;
    }
    return true;
  };

  return {
    sound,
    popup,
    taskbar,
    soundCooldownMs,
    soundPreset,
    customSoundUrl,
    channelNotifications,
    dmNotifications,
    shouldNotify,
  };
}

export function checkIsMention(content: string, myNicks: string[]): boolean {
  if (!content || !myNicks || myNicks.length === 0) return false;
  return myNicks.some((nick) => {
    if (!nick || !nick.trim()) return false;
    const escaped = nick.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // @nick only when @ is not mid-email; bare nick / nick: / nick, at word boundaries
    return (
      new RegExp(`(?<![A-Za-z0-9._%+-])@${escaped}\\b`, "i").test(content) ||
      new RegExp(`(?:^|\\s)${escaped}(?:[:,]?(?:\\s|$))`, "i").test(content) ||
      new RegExp(`(?<![A-Za-z0-9._%+-])\\b${escaped}\\b(?![.@])`, "i").test(content)
    );
  });
}

export interface TriggerNotificationParams {
  title: string;
  /** Name of the chat (channel or person) the messages come from; titles a grouped notification. Defaults to the title. */
  chatName?: string;
  body: string;
  sender?: string;
  tag?: string;
  hasMention?: boolean;
  effectiveSettings: {
    sound: boolean;
    popup: boolean;
    taskbar: boolean;
    soundCooldownMs: number;
    soundPreset: SoundPreset;
    customSoundUrl?: string;
    channelNotifications?: ChannelNotificationMode;
    dmNotifications?: DmNotificationMode;
    shouldNotify?: (hasMention?: boolean) => boolean;
  };
  soundPreset?: SoundPreset;
}

export async function requestDesktopNotificationPermission(): Promise<NotificationPermission> {
  try {
    const granted = await tauriIsPermissionGranted();
    if (granted) return "granted";
    const perm = await tauriRequestPermission();
    return perm === "granted" ? "granted" : "denied";
  } catch (_) {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        return await Notification.requestPermission();
      }
      return Notification.permission;
    }
  }
  return "denied";
}

const isLinux =
  typeof navigator !== "undefined" &&
  navigator.userAgent.toLowerCase().includes("linux");

const isTauriEnv =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI_IPC__" in window || "__TAURI__" in window);

// --- Per-Tag Throttling Maps ---
const lastSoundPlayedByTag = new Map<string, number>();
const lastPopupPlayedByTag = new Map<string, number>();

// --- Per-Channel Accumulative Notification State ---
interface UnreadGroup {
  tag: string;
  baseTitle: string;
  chatName: string;
  count: number;
  lastSender?: string;
  lastBody: string;
}

const unreadGroupsMap = new Map<string, UnreadGroup>();

export function clearNotificationGroup(tag: string) {
  unreadGroupsMap.delete(tag);
  lastSoundPlayedByTag.delete(tag);
  lastPopupPlayedByTag.delete(tag);
  if (isTauriEnv && isLinux) {
    invoke("clear_os_notification", { tag }).catch(() => {});
  }
}

export async function triggerIncomingNotification({
  title,
  chatName,
  body,
  sender,
  tag = "default",
  hasMention = false,
  effectiveSettings,
  soundPreset,
}: TriggerNotificationParams): Promise<void> {
  const { sound, popup, taskbar, soundCooldownMs, customSoundUrl } = effectiveSettings;
  const toneToPlay = soundPreset || effectiveSettings.soundPreset || "chime";

  // 1. Play Sound with Throttle/Cooldown per Tag (mentions bypass cooldown)
  if (sound) {
    const now = Date.now();
    const lastPlayed = lastSoundPlayedByTag.get(tag) || 0;
    if (hasMention || now - lastPlayed >= soundCooldownMs) {
      lastSoundPlayedByTag.set(tag, now);
      playNotificationSound(toneToPlay, customSoundUrl);
    }
  }

  // 2. Accumulate & Update Group Notification per Channel/DM Tag
  if (popup) {
    let group = unreadGroupsMap.get(tag);
    if (group) {
      group.count += 1;
      group.lastSender = sender;
      group.lastBody = body;
    } else {
      group = {
        tag,
        baseTitle: title,
        chatName: chatName ?? title,
        count: 1,
        lastSender: sender,
        lastBody: body,
      };
      unreadGroupsMap.set(tag, group);
    }

    const now = Date.now();
    const lastPopup = lastPopupPlayedByTag.get(tag) || 0;
    if (hasMention || now - lastPopup >= soundCooldownMs) {
      lastPopupPlayedByTag.set(tag, now);

      let finalTitle = group.baseTitle;
      let finalBody = group.lastBody;

      if (group.count > 1) {
        // The title of the first message names its sender, but the group holds messages from several people: title it with the chat.
        finalTitle = `${group.chatName} (${i18n.t("notif.newMessages", { count: group.count })})`;
        finalBody = group.lastSender ? `${group.lastSender}: ${group.lastBody}` : group.lastBody;
      }

      if (isTauriEnv && isLinux) {
        try {
          await invoke("send_os_notification", {
            title: finalTitle,
            body: finalBody,
            tag: group.tag,
          });
        } catch (e) {
          console.warn("[NotificationService] notify-send failed:", e);
        }
      } else if (isTauriEnv && !isLinux) {
        try {
          let granted = await tauriIsPermissionGranted();
          if (!granted) {
            const perm = await tauriRequestPermission();
            granted = perm === "granted";
          }
          if (granted) {
            await tauriSendNotification({ title: finalTitle, body: finalBody });
          }
        } catch (e) {
          console.warn("[NotificationService] Native Tauri notification failed:", e);
        }
      } else if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          try {
            const groupTag = group.tag;
            const notif = new Notification(finalTitle, { body: finalBody, tag: groupTag });
            notif.onclick = () => {
              if (typeof window !== "undefined") {
                window.focus();
              }
              if (isTauriEnv) {
                import("@tauri-apps/api/event")
                  .then(({ emit }) => {
                    emit("notification_clicked", groupTag);
                  })
                  .catch(() => {});
              }
            };
          } catch (e) {
            console.error("[NotificationService] Web Notification error:", e);
          }
        }
      }
    }
  }

  // 3. Taskbar Icon Highlight / User Attention (when window unfocused)
  if (taskbar && typeof window !== "undefined" && !document.hasFocus()) {
    try {
      const windowApi = await import("@tauri-apps/api/window");
      if (windowApi?.getCurrentWindow) {
        const appWindow = windowApi.getCurrentWindow();
        const attentionType = windowApi.UserAttentionType
          ? windowApi.UserAttentionType.Informational
          : 1;
        await appWindow.requestUserAttention(attentionType as any);
      }
    } catch (e) {
      console.warn("[NotificationService] Taskbar attention request failed:", e);
    }
  }
}
