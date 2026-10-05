import type { NotificationSettingsValues } from "@/components/notifications/notification-settings-fields";
import {
  M3ListGroup,
  M3SelectItem,
  M3Subheader,
  type M3Option,
  type M3PickerRequest,
} from "@/components/mobile/m3";

export interface InheritedLabels {
  channelNotifications: string;
  dmNotifications: string;
  sound: string;
  soundPreset: string;
  dmSoundPreset?: string;
  cooldownSec: string;
  popup: string;
}

const SOUNDS: M3Option[] = [
  { value: "chime", label: "Harmonic chime" },
  { value: "ping", label: "Crisp ping" },
  { value: "bell", label: "Warm bell" },
  { value: "pop", label: "Bubble pop" },
];

const soundLabel = (preset: string) =>
  SOUNDS.find((s) => s.value === preset)?.label ?? (preset === "custom" ? "Custom file" : preset);

const withCustom = (options: M3Option[], current: unknown) =>
  current === "custom" ? [...options, { value: "custom", label: "Custom file" }] : options;

/**
 * Per-server / per-channel notification overrides; every row offers
 * "Default (…)" which inherits from the parent level.
 */
export const MobileNotificationOverrides = ({
  mode,
  values,
  inherited,
  onChange,
  openPicker,
}: {
  mode: "server" | "channel" | "dm";
  values: NotificationSettingsValues;
  inherited: InheritedLabels;
  onChange: (field: keyof NotificationSettingsValues, value: any) => void;
  openPicker: (req: M3PickerRequest) => void;
}) => {
  const showChannel = mode !== "dm";
  const showDm = mode !== "channel";
  const cooldown = values.soundCooldown ?? "default";
  const cooldownValue = cooldown === "default" ? "default" : String(cooldown);
  const cooldownOptions: M3Option[] = [
    { value: "default", label: `Default (${inherited.cooldownSec} seconds)` },
    { value: "0", label: "No cooldown" },
    { value: "1000", label: "1 second" },
    { value: "3000", label: "3 seconds" },
    { value: "5000", label: "5 seconds" },
    { value: "10000", label: "10 seconds" },
  ];
  if (!cooldownOptions.some((o) => o.value === cooldownValue)) {
    cooldownOptions.push({
      value: cooldownValue,
      label: `${Number(cooldownValue) / 1000} seconds`,
    });
  }

  return (
    <>
      <M3Subheader>Notifications</M3Subheader>
      <M3ListGroup>
        {showChannel && (
          <M3SelectItem
            title={mode === "server" ? "Channel notifications" : "Notify me about"}
            value={String(values.channelNotifications ?? "default")}
            options={[
              { value: "default", label: `Default (${inherited.channelNotifications})` },
              { value: "mentions", label: "Mentions only" },
              { value: "all", label: "All messages" },
              { value: "off", label: "Off" },
            ]}
            onChange={(v) => onChange("channelNotifications", v)}
            openPicker={openPicker}
          />
        )}
        {showDm && (
          <M3SelectItem
            title={mode === "server" ? "Direct message notifications" : "Notify me about"}
            value={String(values.dmNotifications ?? "default")}
            options={[
              { value: "default", label: `Default (${inherited.dmNotifications})` },
              { value: "all", label: "All messages" },
              { value: "off", label: "Off" },
            ]}
            onChange={(v) => onChange("dmNotifications", v)}
            openPicker={openPicker}
          />
        )}
        <M3SelectItem
          title="Popup notifications"
          value={String(values.popup ?? "default")}
          options={[
            { value: "default", label: `Default (${inherited.popup})` },
            { value: "enabled", label: "On" },
            { value: "disabled", label: "Off" },
          ]}
          onChange={(v) => onChange("popup", v)}
          openPicker={openPicker}
          divider={false}
        />
      </M3ListGroup>

      <M3Subheader>Sound</M3Subheader>
      <M3ListGroup>
        <M3SelectItem
          title="Notification sound"
          value={String(values.sound ?? "default")}
          options={[
            { value: "default", label: `Default (${inherited.sound})` },
            { value: "enabled", label: "On" },
            { value: "disabled", label: "Muted" },
          ]}
          onChange={(v) => onChange("sound", v)}
          openPicker={openPicker}
        />
        {mode !== "dm" && (
          <M3SelectItem
            title={mode === "server" ? "Channel sound" : "Sound"}
            value={String(values.soundPreset ?? "default")}
            options={withCustom(
              [{ value: "default", label: `Default (${soundLabel(inherited.soundPreset)})` }, ...SOUNDS],
              values.soundPreset
            )}
            onChange={(v) => onChange("soundPreset", v)}
            openPicker={openPicker}
          />
        )}
        {mode !== "channel" && (
          <M3SelectItem
            title={mode === "server" ? "Direct message sound" : "Sound"}
            value={String((mode === "server" ? values.dmSoundPreset : values.soundPreset) ?? "default")}
            options={withCustom(
              [
                {
                  value: "default",
                  label: `Default (${soundLabel(inherited.dmSoundPreset ?? inherited.soundPreset)})`,
                },
                ...SOUNDS,
              ],
              mode === "server" ? values.dmSoundPreset : values.soundPreset
            )}
            onChange={(v) => onChange(mode === "server" ? "dmSoundPreset" : "soundPreset", v)}
            openPicker={openPicker}
          />
        )}
        <M3SelectItem
          title="Sound cooldown"
          value={cooldownValue}
          options={cooldownOptions}
          onChange={(v) => onChange("soundCooldown", v === "default" ? "default" : Number(v))}
          openPicker={openPicker}
          divider={false}
        />
      </M3ListGroup>
    </>
  );
};
