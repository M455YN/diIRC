import React, { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Bell, Volume2, Monitor, Clock, Play, FolderOpen, Music, AlertTriangle, AlertCircle, MessageSquare, Hash } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SoundPreset, NotificationOverrideValue, ChannelNotificationMode, DmNotificationMode, ChannelNotificationOverrideValue, DmNotificationOverrideValue } from "@/types";
import { playNotificationSound } from "@/lib/notification-sound";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { readFile, stat } from "@tauri-apps/plugin-fs";
import { convertFileSrc } from "@tauri-apps/api/core";

export interface NotificationSettingsValues {
  channelNotifications?: ChannelNotificationMode | ChannelNotificationOverrideValue;
  dmNotifications?: DmNotificationMode | DmNotificationOverrideValue;
  sound?: boolean | NotificationOverrideValue;
  soundPreset?: SoundPreset | "default";
  dmSoundPreset?: SoundPreset | "default";
  customSoundUrl?: string;
  customDmSoundUrl?: string;
  soundCooldown?: number | "default";
  popup?: boolean | NotificationOverrideValue;
  taskbar?: boolean | NotificationOverrideValue;
}

export interface InheritedNotificationValues {
  channelNotificationsStr?: string;
  dmNotificationsStr?: string;
  soundStr?: string;
  soundPresetStr?: string;
  dmSoundPresetStr?: string;
  cooldownSec?: string;
  popupStr?: string;
  taskbarStr?: string;
}

interface NotificationSettingsFieldsProps {
  mode: "global" | "server" | "channel" | "dm";
  values: NotificationSettingsValues;
  inherited?: InheritedNotificationValues;
  onChange: (field: keyof NotificationSettingsValues, value: any) => void;
}

const isTauriEnv =
  typeof window !== "undefined" &&
  ("__TAURI_INTERNALS__" in window || "__TAURI_IPC__" in window || "__TAURI__" in window);

const MAX_SOUND_FILE_SIZE_MB = 5;
const MAX_SOUND_FILE_SIZE_BYTES = MAX_SOUND_FILE_SIZE_MB * 1024 * 1024;

export const NotificationSettingsFields: React.FC<NotificationSettingsFieldsProps> = ({
  mode,
  values,
  inherited = {},
  onChange,
}) => {
  const { t } = useTranslation();
  const channelFileInputRef = useRef<HTMLInputElement>(null);
  const dmFileInputRef = useRef<HTMLInputElement>(null);

  const [channelFileError, setChannelFileError] = useState<string | null>(null);
  const [dmFileError, setDmFileError] = useState<string | null>(null);

  const isGlobal = mode === "global";
  const isServer = mode === "server";
  const isChannelOrDm = mode === "channel" || mode === "dm";
  const isChannelMode = mode === "channel";
  const isDmMode = mode === "dm";

  const triggerFileSelection = async (
    field: "customSoundUrl" | "customDmSoundUrl",
    presetField: "soundPreset" | "dmSoundPreset",
    fallbackRef: React.RefObject<HTMLInputElement>,
    setError: (err: string | null) => void
  ) => {
    setError(null);
    if (isTauriEnv) {
      try {
        const selected = await openFileDialog({
          multiple: false,
          filters: [
            {
              name: "Audio Files",
              extensions: ["mp3", "wav", "ogg", "flac", "m4a", "aac", "webm"],
            },
          ],
        });

        if (selected && typeof selected === "string") {
          try {
            // Check file size using Tauri FS stat first
            try {
              const fileStats = await stat(selected);
              if (fileStats.size > MAX_SOUND_FILE_SIZE_BYTES) {
                const sizeMB = (fileStats.size / (1024 * 1024)).toFixed(1);
                setError(`Audio file is too large (${sizeMB} MB). Maximum allowed size is ${MAX_SOUND_FILE_SIZE_MB} MB.`);
                return;
              }
            } catch (statErr) {
              console.warn("Could not stat file size beforehand:", statErr);
            }

            // Read file directly from local filesystem using Tauri FS plugin
            const contents = await readFile(selected);

            if (contents.byteLength > MAX_SOUND_FILE_SIZE_BYTES) {
              const sizeMB = (contents.byteLength / (1024 * 1024)).toFixed(1);
              setError(`Audio file is too large (${sizeMB} MB). Maximum allowed size is ${MAX_SOUND_FILE_SIZE_MB} MB.`);
              return;
            }

            const ext = selected.split(".").pop()?.toLowerCase() || "mp3";
            const mimeTypeMap: Record<string, string> = {
              mp3: "audio/mpeg",
              wav: "audio/wav",
              ogg: "audio/ogg",
              flac: "audio/flac",
              m4a: "audio/aac",
              aac: "audio/aac",
              webm: "audio/webm",
            };
            const mimeType = mimeTypeMap[ext] || "audio/mpeg";
            const blob = new Blob([contents], { type: mimeType });

            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });

            onChange(field, dataUrl);
            onChange(presetField, "custom");
            setError(null);
            return;
          } catch (readErr: any) {
            console.warn("Failed to read audio file via Tauri FS, trying convertFileSrc fallback:", readErr);
            try {
              const assetUrl = convertFileSrc(selected);
              onChange(field, assetUrl);
              onChange(presetField, "custom");
              setError(null);
              return;
            } catch (fallbackErr: any) {
              setError(`Failed to read audio file: ${readErr?.message || "File access denied"}`);
              return;
            }
          }
        }
      } catch (err: any) {
        console.warn("Tauri dialog error, using HTML file picker fallback:", err);
      }
    }
    fallbackRef.current?.click();
  };

  const handleHTMLFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: "customSoundUrl" | "customDmSoundUrl",
    presetField: "soundPreset" | "dmSoundPreset",
    setError: (err: string | null) => void
  ) => {
    setError(null);
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > MAX_SOUND_FILE_SIZE_BYTES) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        setError(`Audio file is too large (${sizeMB} MB). Maximum allowed size is ${MAX_SOUND_FILE_SIZE_MB} MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        if (dataUrl) {
          onChange(field, dataUrl);
          onChange(presetField, "custom");
          setError(null);
        }
      };
      reader.onerror = (err) => {
        setError("Failed to read audio file from disk.");
      };
      reader.readAsDataURL(file);
    }
  };

  const soundIsEnabled = isGlobal
    ? Boolean(values.sound)
    : values.sound !== "disabled";

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 shadow-sm">
      <div className="flex items-center gap-x-2">
        <Bell className="w-4 h-4 text-zinc-600 dark:text-zinc-300" />
        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
          {isGlobal
            ? t("settings.notifications.globalTitle")
            : isServer
              ? t("settings.notifications.serverTitle")
              : t("settings.notifications.overridesTitle")}
        </span>
      </div>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
        {isGlobal
          ? t("settings.notifications.globalDesc")
          : isServer
            ? t("settings.notifications.serverDesc")
            : t("settings.notifications.channelDesc")}
      </p>

      {/* CHANNEL NOTIFICATIONS CONTROL */}
      {(isGlobal || isServer || isChannelMode) && (
        <div className="flex items-center justify-between gap-x-2 pt-2 border-t border-zinc-200 dark:border-zinc-700/60">
          <div className="flex items-center gap-x-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            <Hash className="w-3.5 h-3.5 text-zinc-500" />
            {t("settings.notifications.channelNotifications")}
          </div>
          {isGlobal ? (
            <select
              value={(values.channelNotifications as string) || "mentions"}
              onChange={(e) => onChange("channelNotifications", e.target.value as ChannelNotificationMode)}
              className="bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="mentions">{t("settings.notifications.mentionsOnlyOpt")}</option>
              <option value="all">{t("settings.notifications.allMessagesOpt")}</option>
              <option value="off">{t("settings.notifications.disabledOpt")}</option>
            </select>
          ) : (
            <select
              value={(values.channelNotifications as string) || "default"}
              onChange={(e) => onChange("channelNotifications", e.target.value as ChannelNotificationOverrideValue)}
              className="bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="default">{t("settings.notifications.defaultOpt")} ({inherited.channelNotificationsStr || t("settings.notifications.mentionsOnly")})</option>
              <option value="mentions">{t("settings.notifications.mentionsOnlyOpt")}</option>
              <option value="all">{t("settings.notifications.allMessagesOpt")}</option>
              <option value="off">{t("settings.notifications.disabledOpt")}</option>
            </select>
          )}
        </div>
      )}

      {/* PRIVATE MESSAGE NOTIFICATIONS CONTROL */}
      {(isGlobal || isServer || isDmMode) && (
        <div className="flex items-center justify-between gap-x-2 pt-2 border-t border-zinc-200 dark:border-zinc-700/60">
          <div className="flex items-center gap-x-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
            <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
            {t("settings.notifications.dmNotifications")}
          </div>
          {isGlobal ? (
            <select
              value={(values.dmNotifications as string) || "all"}
              onChange={(e) => onChange("dmNotifications", e.target.value as DmNotificationMode)}
              className="bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">{t("settings.notifications.enabledAllOpt")}</option>
              <option value="off">{t("settings.notifications.disabledOpt")}</option>
            </select>
          ) : (
            <select
              value={(values.dmNotifications as string) || "default"}
              onChange={(e) => onChange("dmNotifications", e.target.value as DmNotificationOverrideValue)}
              className="bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="default">{t("settings.notifications.defaultOpt")} ({inherited.dmNotificationsStr || t("settings.notifications.enabled")})</option>
              <option value="all">{t("settings.notifications.enabledOpt")}</option>
              <option value="off">{t("settings.notifications.disabledOpt")}</option>
            </select>
          )}
        </div>
      )}

      {/* 1. Sound Alert Switch or Select */}
      <div className="flex items-center justify-between gap-x-2 pt-2 border-t border-zinc-200 dark:border-zinc-700/60">
        <div className="flex items-center gap-x-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          <Volume2 className="w-3.5 h-3.5 text-zinc-500" />
          {t("settings.notifications.soundAlert")}
        </div>
        {isGlobal ? (
          <Switch
            checked={Boolean(values.sound)}
            onCheckedChange={(checked) => onChange("sound", checked)}
          />
        ) : (
          <select
            value={(values.sound as string) || "default"}
            onChange={(e) => onChange("sound", e.target.value as NotificationOverrideValue)}
            className="bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="default">{t("settings.notifications.defaultOpt")} ({inherited.soundStr || t("settings.notifications.enabled")})</option>
            <option value="enabled">{t("settings.notifications.enabledOpt")}</option>
            <option value="disabled">{t("settings.notifications.disabledMuteOpt")}</option>
          </select>
        )}
      </div>

      {/* 2. Sound Tone / Presets */}
      {soundIsEnabled && (
        <>
          {/* Hidden HTML File Inputs */}
          <input
            type="file"
            ref={channelFileInputRef}
            accept="audio/*"
            className="hidden"
            onChange={(e) => handleHTMLFileUpload(e, "customSoundUrl", "soundPreset", setChannelFileError)}
          />
          <input
            type="file"
            ref={dmFileInputRef}
            accept="audio/*"
            className="hidden"
            onChange={(e) => handleHTMLFileUpload(e, "customDmSoundUrl", "dmSoundPreset", setDmFileError)}
          />

          {/* Channel Sound Tone (or generic Sound Tone for channel/dm) */}
          <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700/60">
            <div className="flex items-center justify-between gap-x-2">
              <div className="flex items-center gap-x-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 shrink-0">
                <Volume2 className="w-3.5 h-3.5 text-zinc-500" />
                {isChannelOrDm
                  ? t("settings.notifications.soundTone")
                  : isServer || isGlobal
                    ? t("settings.notifications.channelSoundTone")
                    : t("settings.notifications.soundTone")}
              </div>

              <div className="flex items-center gap-x-1.5 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const preset = (values.soundPreset === "default" ? inherited.soundPresetStr : values.soundPreset) as SoundPreset || "chime";
                    playNotificationSound(preset, values.customSoundUrl);
                  }}
                  title={t("settings.notifications.testSound")}
                  className="h-8 px-2.5 bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-x-1"
                >
                  <Play className="w-3.5 h-3.5 fill-current text-indigo-500" />
                  <span className="text-[11px] font-semibold">Test</span>
                </Button>

                {values.soundPreset === "custom" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => triggerFileSelection("customSoundUrl", "soundPreset", channelFileInputRef, setChannelFileError)}
                    className="h-8 text-[11px] px-2 font-semibold bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <FolderOpen className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                    {t("settings.notifications.browse")}
                  </Button>
                )}

                <select
                  value={values.soundPreset || (isGlobal ? "chime" : "default")}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "custom") {
                      onChange("soundPreset", "custom");
                      triggerFileSelection("customSoundUrl", "soundPreset", channelFileInputRef, setChannelFileError);
                    } else {
                      onChange("soundPreset", val);
                      setChannelFileError(null);
                    }
                  }}
                  className="h-8 bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  {!isGlobal && (
                    <option value="default">{t("settings.notifications.defaultOpt")} ({inherited.soundPresetStr || "chime"})</option>
                  )}
                  <option value="chime">{t("settings.notifications.harmonicChime")}</option>
                  <option value="ping">{t("settings.notifications.crispPing")}</option>
                  <option value="bell">{t("settings.notifications.warmBell")}</option>
                  <option value="pop">{t("settings.notifications.bubblePop")}</option>
                  <option value="marimba">{t("settings.notifications.marimbaOpt")}</option>
                  <option value="glass">{t("settings.notifications.glassOpt")}</option>
                  <option value="custom">{t("settings.notifications.customAudioOpt")}</option>
                </select>
              </div>
            </div>

            {channelFileError && (
              <div className="flex items-center gap-x-2 bg-red-500/10 border border-red-500/30 p-2 rounded-lg text-xs text-red-600 dark:text-red-400">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{channelFileError}</span>
              </div>
            )}

            {values.soundPreset === "custom" && !channelFileError && (
              <div className="flex items-center justify-between bg-zinc-100 dark:bg-[#1e1f22] p-2 rounded-lg border border-zinc-200 dark:border-zinc-700/60 text-xs">
                <div className="flex items-center gap-x-2 truncate">
                  <Music className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate text-zinc-700 dark:text-zinc-300 font-medium">
                    {values.customSoundUrl ? t("settings.notifications.customLoaded") : t("settings.notifications.noFile")}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => triggerFileSelection("customSoundUrl", "soundPreset", channelFileInputRef, setChannelFileError)}
                  className="h-6 text-[11px] px-2 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {t("settings.notifications.changeFile")}
                </Button>
              </div>
            )}
          </div>

          {/* DM Sound Tone (for Global and Server settings) */}
          {(isGlobal || isServer) && (
            <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700/60">
              <div className="flex items-center justify-between gap-x-2">
                <div className="flex items-center gap-x-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 shrink-0">
                  <Volume2 className="w-3.5 h-3.5 text-zinc-500" />
                  {t("settings.notifications.dmSoundTone")}
                </div>

                <div className="flex items-center gap-x-1.5 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const preset = (values.dmSoundPreset === "default" ? inherited.dmSoundPresetStr : values.dmSoundPreset) as SoundPreset || "chime";
                      playNotificationSound(preset, values.customDmSoundUrl || values.customSoundUrl);
                    }}
                    title={t("settings.notifications.testDmSound")}
                    className="h-8 px-2.5 bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-x-1"
                  >
                    <Play className="w-3.5 h-3.5 fill-current text-indigo-500" />
                    <span className="text-[11px] font-semibold">Test</span>
                  </Button>

                  {values.dmSoundPreset === "custom" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => triggerFileSelection("customDmSoundUrl", "dmSoundPreset", dmFileInputRef, setDmFileError)}
                      className="h-8 text-[11px] px-2 font-semibold bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <FolderOpen className="w-3.5 h-3.5 mr-1 text-indigo-500" />
                      {t("settings.notifications.browse")}
                    </Button>
                  )}

                  <select
                    value={values.dmSoundPreset || (isGlobal ? "chime" : "default")}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "custom") {
                        onChange("dmSoundPreset", "custom");
                        triggerFileSelection("customDmSoundUrl", "dmSoundPreset", dmFileInputRef, setDmFileError);
                      } else {
                        onChange("dmSoundPreset", val);
                        setDmFileError(null);
                      }
                    }}
                    className="h-8 bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {!isGlobal && (
                      <option value="default">{t("settings.notifications.defaultOpt")} ({inherited.dmSoundPresetStr || "chime"})</option>
                    )}
                    <option value="chime">{t("settings.notifications.harmonicChime")}</option>
                    <option value="ping">{t("settings.notifications.crispPing")}</option>
                    <option value="bell">{t("settings.notifications.warmBell")}</option>
                    <option value="pop">{t("settings.notifications.bubblePop")}</option>
                    <option value="marimba">{t("settings.notifications.marimbaOpt")}</option>
                    <option value="glass">{t("settings.notifications.glassOpt")}</option>
                    <option value="custom">{t("settings.notifications.customAudioOpt")}</option>
                  </select>
                </div>
              </div>

              {dmFileError && (
                <div className="flex items-center gap-x-2 bg-red-500/10 border border-red-500/30 p-2 rounded-lg text-xs text-red-600 dark:text-red-400">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{dmFileError}</span>
                </div>
              )}

              {values.dmSoundPreset === "custom" && !dmFileError && (
                <div className="flex items-center justify-between bg-zinc-100 dark:bg-[#1e1f22] p-2 rounded-lg border border-zinc-200 dark:border-zinc-700/60 text-xs">
                  <div className="flex items-center gap-x-2 truncate">
                    <Music className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span className="truncate text-zinc-700 dark:text-zinc-300 font-medium">
                      {values.customDmSoundUrl ? t("settings.notifications.customDmLoaded") : t("settings.notifications.noFile")}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => triggerFileSelection("customDmSoundUrl", "dmSoundPreset", dmFileInputRef, setDmFileError)}
                    className="h-6 text-[11px] px-2 font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    {t("settings.notifications.changeFile")}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* 3. Sound Cooldown / Rate Limit */}
          <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700/60">
            <div className="flex items-center justify-between gap-x-2">
              <div className="flex items-center gap-x-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                {t("settings.notifications.cooldownTitle")}
              </div>
              {!isGlobal && (
                <select
                  value={values.soundCooldown === "default" ? "default" : "custom"}
                  onChange={(e) => {
                    if (e.target.value === "default") {
                      onChange("soundCooldown", "default");
                    } else {
                      onChange(
                        "soundCooldown",
                        typeof values.soundCooldown === "number" ? values.soundCooldown : 2500
                      );
                    }
                  }}
                  className="bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="default">{t("settings.notifications.defaultOpt")} ({inherited.cooldownSec || "2.5"}s)</option>
                  <option value="custom">{t("settings.notifications.customCooldownOpt")}</option>
                </select>
              )}
            </div>

            {(isGlobal || values.soundCooldown !== "default") && (
              <div className="flex items-center gap-x-3 pt-1">
                <input
                  type="range"
                  min={0}
                  max={60}
                  step={1}
                  value={Math.round((typeof values.soundCooldown === "number" ? values.soundCooldown : 2500) / 1000)}
                  onChange={(e) => onChange("soundCooldown", Number(e.target.value) * 1000)}
                  className="flex-1 accent-indigo-600 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg cursor-pointer"
                />
                <div className="flex items-center gap-x-1">
                  <Input
                    type="number"
                    min={0}
                    max={300}
                    value={Math.round((typeof values.soundCooldown === "number" ? values.soundCooldown : 2500) / 1000)}
                    onChange={(e) => {
                      const val = Math.max(0, Math.min(300, Number(e.target.value) || 0));
                      onChange("soundCooldown", val * 1000);
                    }}
                    className="w-16 h-7 text-xs text-center font-mono font-bold bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100"
                  />
                  <span className="text-xs font-semibold text-zinc-500">s</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* 4. System Desktop Popup */}
      <div className="flex items-center justify-between gap-x-2 pt-2 border-t border-zinc-200 dark:border-zinc-700/60">
        <div className="flex items-center gap-x-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          <Bell className="w-3.5 h-3.5 text-zinc-500" />
          {t("settings.notifications.desktopPopup")}
        </div>
        {isGlobal ? (
          <Switch
            checked={Boolean(values.popup)}
            onCheckedChange={(checked) => onChange("popup", checked)}
          />
        ) : (
          <select
            value={(values.popup as string) || "default"}
            onChange={(e) => onChange("popup", e.target.value as NotificationOverrideValue)}
            className="bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="default">{t("settings.notifications.defaultOpt")} ({inherited.popupStr || t("settings.notifications.enabled")})</option>
            <option value="enabled">{t("settings.notifications.enabledOpt")}</option>
            <option value="disabled">{t("settings.notifications.disabledOpt")}</option>
          </select>
        )}
      </div>

      {/* 5. Taskbar Alert */}
      <div className="flex items-center justify-between gap-x-2 pt-2 border-t border-zinc-200 dark:border-zinc-700/60">
        <div className="flex items-center gap-x-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
          <Monitor className="w-3.5 h-3.5 text-zinc-500" />
          {t("settings.notifications.taskbarAlert")}
        </div>
        {isGlobal ? (
          <Switch
            checked={Boolean(values.taskbar)}
            onCheckedChange={(checked) => onChange("taskbar", checked)}
          />
        ) : (
          <select
            value={(values.taskbar as string) || "default"}
            onChange={(e) => onChange("taskbar", e.target.value as NotificationOverrideValue)}
            className="bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="default">{t("settings.notifications.defaultOpt")} ({inherited.taskbarStr || t("settings.notifications.enabled")})</option>
            <option value="enabled">{t("settings.notifications.enabledOpt")}</option>
            <option value="disabled">{t("settings.notifications.disabledOpt")}</option>
          </select>
        )}
      </div>
    </div>
  );
};
