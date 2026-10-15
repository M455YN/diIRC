import { useTranslation } from "react-i18next";
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

type Tr = (key: string) => string;

const soundOptions = (tr: Tr): M3Option[] => [
  { value: "chime", label: tr("mobile.sound.chime") },
  { value: "ping", label: tr("mobile.sound.ping") },
  { value: "bell", label: tr("mobile.sound.bell") },
  { value: "pop", label: tr("mobile.sound.pop") },
  { value: "marimba", label: tr("mobile.sound.marimba") },
  { value: "glass", label: tr("mobile.sound.glass") },
];

const soundLabel = (preset: string, tr: Tr) =>
  soundOptions(tr).find((s) => s.value === preset)?.label ?? (preset === "custom" ? tr("mobile.sound.customFile") : preset);

const withCustom = (options: M3Option[], current: unknown, tr: Tr) =>
  current === "custom" ? [...options, { value: "custom", label: tr("mobile.sound.customFile") }] : options;

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
  const { t: tr } = useTranslation();
  const showChannel = mode !== "dm";
  const showDm = mode !== "channel";
  const cooldown = values.soundCooldown ?? "default";
  const cooldownValue = cooldown === "default" ? "default" : String(cooldown);
  const cooldownOptions: M3Option[] = [
    { value: "default", label: `${tr("mform.defaultPrefix")} (${inherited.cooldownSec} ${tr("nso.seconds")})` },
    { value: "0", label: tr("nso.noCooldown") },
    { value: "1000", label: tr("nso.second1") },
    { value: "3000", label: tr("nso.seconds3") },
    { value: "5000", label: tr("nso.seconds5") },
    { value: "10000", label: tr("nso.seconds10") },
  ];
  if (!cooldownOptions.some((o) => o.value === cooldownValue)) {
    cooldownOptions.push({
      value: cooldownValue,
      label: `${Number(cooldownValue) / 1000} seconds`,
    });
  }

  return (
    <>
      <M3Subheader>{tr("mi.notificationsHeading")}</M3Subheader>
      <M3ListGroup>
        {showChannel && (
          <M3SelectItem
            title={mode === "server" ? tr("nso.channelNotifications") : tr("nso.notifyAbout")}
            value={String(values.channelNotifications ?? "default")}
            options={[
              { value: "default", label: `${tr("mform.defaultPrefix")} (${inherited.channelNotifications})` },
              { value: "mentions", label: tr("nso.mentionsOnly") },
              { value: "all", label: tr("nso.allMessages") },
              { value: "off", label: tr("nso.off") },
            ]}
            onChange={(v) => onChange("channelNotifications", v)}
            openPicker={openPicker}
          />
        )}
        {showDm && (
          <M3SelectItem
            title={mode === "server" ? tr("nso.dmNotifications") : tr("nso.notifyAbout")}
            value={String(values.dmNotifications ?? "default")}
            options={[
              { value: "default", label: `${tr("mform.defaultPrefix")} (${inherited.dmNotifications})` },
              { value: "all", label: tr("nso.allMessages") },
              { value: "off", label: tr("nso.off") },
            ]}
            onChange={(v) => onChange("dmNotifications", v)}
            openPicker={openPicker}
          />
        )}
        <M3SelectItem
          title={tr("nso.popup")}
          value={String(values.popup ?? "default")}
          options={[
            { value: "default", label: `${tr("mform.defaultPrefix")} (${inherited.popup})` },
            { value: "enabled", label: tr("nso.on") },
            { value: "disabled", label: tr("nso.off") },
          ]}
          onChange={(v) => onChange("popup", v)}
          openPicker={openPicker}
          divider={false}
        />
      </M3ListGroup>

      <M3Subheader>{tr("nso.sound")}</M3Subheader>
      <M3ListGroup>
        <M3SelectItem
          title={tr("nso.notificationSound")}
          value={String(values.sound ?? "default")}
          options={[
            { value: "default", label: `${tr("mform.defaultPrefix")} (${inherited.sound})` },
            { value: "enabled", label: tr("nso.on") },
            { value: "disabled", label: tr("nso.muted") },
          ]}
          onChange={(v) => onChange("sound", v)}
          openPicker={openPicker}
        />
        {mode !== "dm" && (
          <M3SelectItem
            title={mode === "server" ? tr("nso.channelSound") : tr("nso.sound")}
            value={String(values.soundPreset ?? "default")}
            options={withCustom(
              [{ value: "default", label: `${tr("mform.defaultPrefix")} (${soundLabel(inherited.soundPreset, tr)})` }, ...soundOptions(tr)],
              values.soundPreset,
              tr
            )}
            onChange={(v) => onChange("soundPreset", v)}
            openPicker={openPicker}
          />
        )}
        {mode !== "channel" && (
          <M3SelectItem
            title={mode === "server" ? tr("nso.dmSound") : tr("nso.sound")}
            value={String((mode === "server" ? values.dmSoundPreset : values.soundPreset) ?? "default")}
            options={withCustom(
              [
                {
                  value: "default",
                  label: `${tr("mform.defaultPrefix")} (${soundLabel(inherited.dmSoundPreset ?? inherited.soundPreset, tr)})`,
                },
                ...soundOptions(tr),
              ],
              mode === "server" ? values.dmSoundPreset : values.soundPreset,
              tr
            )}
            onChange={(v) => onChange(mode === "server" ? "dmSoundPreset" : "soundPreset", v)}
            openPicker={openPicker}
          />
        )}
        <M3SelectItem
          title={tr("nso.soundCooldown")}
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
