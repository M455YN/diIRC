import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Box from "@mui/material/Box";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import FileOpenOutlinedIcon from "@mui/icons-material/FileOpenOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";
import {
  normalizeCustomCommandsFromForm,
  parseCustomCommandsJson,
} from "@/components/server/custom-commands-fields";
import {
  emptyFormCommand,
  emptyFormStep,
  toFormSteps,
  type FormCommandRow,
  type FormStep,
} from "@/lib/commands/custom-command-steps";
import type { NotificationSettingsValues } from "@/components/notifications/notification-settings-fields";
import { MobileNotificationOverrides } from "@/components/mobile/mobile-notification-overrides";
import { ServerLogoField } from "@/components/server/server-logo-field";
import {
  M3Button,
  M3Card,
  M3Chip,
  M3Dialog,
  M3FullScreenDialog,
  M3IconButton,
  M3ListGroup,
  M3SelectItem,
  M3Subheader,
  M3SwitchItem,
  M3TextField,
  useM3,
  useM3Picker,
} from "@/components/mobile/m3";
import type {
  ReplyMode,
  ServerMediaCollapseMode,
  ServerMotdDisplayPolicy,
  ServerUserDisplayNameMode,
} from "@/types";

type ServerReplyMode = "inherit" | ReplyMode;

type CommandRow = FormCommandRow;

const STEP_TYPES: { value: FormStep["type"]; label: string }[] = [
  { value: "message", label: "cb.stepMessage" },
  { value: "mention", label: "cb.stepMention" },
  { value: "openUrl", label: "cb.stepOpenUrl" },
];

interface FormState {
  imageUrl: string;
  name: string;
  host: string;
  port: string;
  password: string;
  useTls: boolean;
  nicknames: string[];
  username: string;
  realname: string;
  autoConnect: boolean;
  autoReconnect: boolean;
  parseLegacyZncTimestamps: boolean;
  replyMode: ServerReplyMode;
  customCommands: CommandRow[];
  motdPolicy: ServerMotdDisplayPolicy;
  displayNameMode: ServerUserDisplayNameMode;
  mediaCollapse: ServerMediaCollapseMode;
  notifications: NotificationSettingsValues;
}

type Errors = Partial<Record<"name" | "host" | "port" | `nick${number}`, string>>;

function validate(f: FormState, t: (key: string) => string): Errors {
  const errors: Errors = {};
  if (!f.name.trim()) errors.name = t("server.validation.nameRequired");
  if (!f.host.trim()) errors.host = t("server.validation.addressRequired");
  const port = Number(f.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.port = t("mform.portRange");
  f.nicknames.forEach((n, i) => {
    if (i === 0 && !n.trim()) errors[`nick${i}`] = t("server.validation.nickRequired");
    else if (/\s/.test(n)) errors[`nick${i}`] = t("server.validation.nickSpaces");
  });
  return errors;
}

const REPLY_LABELS: Record<ReplyMode, string> = {
  auto: "mform.replyAuto",
  modern: "mform.replyModern",
  legacy: "mform.replyLegacy",
  hybrid: "mform.replyHybrid",
};

const ServerFormBody = ({
  form,
  set,
  errors,
  isEdit,
  openPicker,
}: {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
  errors: Errors;
  isEdit: boolean;
  openPicker: ReturnType<typeof useM3Picker>["open"];
}) => {
  const { t: tr } = useTranslation();
  const t = useM3();
  const [showPassword, setShowPassword] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [openOptions, setOpenOptions] = useState<Set<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);

  const globalNotif = useMockStore((s) => s.notificationSettings);
  const globalMotdPolicy = useMockStore((s) => s.globalMotdPolicy) || "on_change";
  const autoCollapseImages = useMockStore((s) => s.autoCollapseImages ?? false);
  const defaultReplyMode = useMockStore((s) => s.defaultReplyMode) || "hybrid";
  const setGlobalMotdPolicy = useMockStore((s) => s.setGlobalMotdPolicy);

  const setCommand = (i: number, key: "trigger" | "description" | "suggestions", value: string) =>
    set(
      "customCommands",
      form.customCommands.map((c, idx) => (idx === i ? { ...c, [key]: value } : c))
    );

  const setSteps = (i: number, update: (steps: FormStep[]) => FormStep[]) =>
    set(
      "customCommands",
      form.customCommands.map((c, idx) => (idx === i ? { ...c, steps: update(c.steps) } : c))
    );

  const patchStep = (i: number, stepIndex: number, patch: Partial<FormStep>) =>
    setSteps(i, (steps) => steps.map((s, k) => (k === stepIndex ? { ...s, ...patch } : s)));

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError(null);
    try {
      set("customCommands", parseCustomCommandsJson(JSON.parse(await file.text())));
    } catch (err: any) {
      setImportError(
        err instanceof SyntaxError ? tr("mform.invalidJson") : err?.message || tr("mform.loadFailed")
      );
    }
  };

  const fields = { display: "flex", flexDirection: "column", gap: 3, px: 0.5, pt: 1.5, pb: 1 } as const;

  return (
    <>
      <M3Subheader>{tr("mform.connection")}</M3Subheader>
      <Box sx={fields}>
        <ServerLogoField value={form.imageUrl} onChange={(v) => set("imageUrl", v)} />
        <M3TextField
          label={tr("mform.serverName")}
          value={form.name}
          onChange={(v) => set("name", v)}
          placeholder={tr("mform.serverNamePlaceholder")}
          error={errors.name}
        />
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
          <Box sx={{ flex: 2.2, minWidth: 0 }}>
            <M3TextField
              label={tr("mform.host")}
              value={form.host}
              inputMode="url"
              onChange={(v) => {
                if (v.includes(":")) {
                  const [h, p] = v.split(":");
                  set("host", h);
                  if (p) set("port", p.replace(/\D/g, ""));
                } else set("host", v);
              }}
              placeholder={tr("mform.hostPlaceholder")}
              error={errors.host}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <M3TextField
              label={tr("mform.port")}
              value={form.port}
              inputMode="numeric"
              onChange={(v) => set("port", v.replace(/\D/g, ""))}
              error={errors.port}
            />
          </Box>
        </Box>
        <M3TextField
          label={tr("mform.password")}
          value={form.password}
          type={showPassword ? "text" : "password"}
          onChange={(v) => set("password", v)}
          supportingText={tr("mform.optional")}
          trailing={
            <M3IconButton
              label={showPassword ? tr("mform.hidePassword") : tr("mform.showPassword")}
              icon={showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
              onClick={() => setShowPassword((s) => !s)}
            />
          }
        />
      </Box>
      <Box sx={{ mt: 1 }}>
        <M3ListGroup>
          <M3SwitchItem
            title={tr("mform.useTls")}
            supporting={tr("mform.useTlsDesc")}
            checked={form.useTls}
            onChange={(v) => {
              set("useTls", v);
              if (v && form.port === "6667") set("port", "6697");
              else if (!v && form.port === "6697") set("port", "6667");
            }}
            divider={false}
          />
        </M3ListGroup>
      </Box>

      <M3Subheader>{tr("mform.identity")}</M3Subheader>
      <Box sx={fields}>
        {form.nicknames.map((nick, i) => (
          <M3TextField
            key={i}
            label={i === 0 ? tr("mform.nickname") : `${tr("mform.fallbackNick")} ${i}`}
            value={nick}
            onChange={(v) =>
              set(
                "nicknames",
                form.nicknames.map((n, idx) => (idx === i ? v : n))
              )
            }
            error={errors[`nick${i}`]}
            trailing={
              i > 0 ? (
                <M3IconButton
                  label={tr("mform.removeNickname")}
                  icon={<CloseIcon />}
                  onClick={() =>
                    set(
                      "nicknames",
                      form.nicknames.filter((_, idx) => idx !== i)
                    )
                  }
                />
              ) : undefined
            }
          />
        ))}
        <Box>
          <M3Button
            variant="text"
            icon={<AddIcon />}
            onClick={() => set("nicknames", [...form.nicknames, ""])}
          >
            {tr("mform.addFallback")}
          </M3Button>
        </Box>
        <M3TextField
          label={tr("mform.username")}
          value={form.username}
          onChange={(v) => set("username", v)}
          supportingText={tr("mform.usernameDesc")}
        />
        <M3TextField
          label={tr("mform.realName")}
          value={form.realname}
          onChange={(v) => set("realname", v)}
          supportingText={tr("mform.optional")}
        />
      </Box>

      <M3Subheader>{tr("mform.behavior")}</M3Subheader>
      <M3ListGroup>
        <M3SwitchItem
          title={tr("mform.autoConnect")}
          checked={form.autoConnect}
          onChange={(v) => set("autoConnect", v)}
        />
        <M3SwitchItem
          title={tr("mform.autoReconnect")}
          supporting={tr("mform.autoReconnectDesc")}
          checked={form.autoReconnect}
          onChange={(v) => set("autoReconnect", v)}
        />
        <M3SwitchItem
          title={tr("mform.zncTimestamps")}
          supporting={tr("mform.zncTimestampsDesc")}
          checked={form.parseLegacyZncTimestamps}
          onChange={(v) => set("parseLegacyZncTimestamps", v)}
        />
        <M3SelectItem
          title={tr("mform.replyFormat")}
          value={form.replyMode}
          options={[
            { value: "inherit", label: `${tr("mform.defaultPrefix")} (${tr(REPLY_LABELS[defaultReplyMode])})` },
            { value: "auto", label: tr("mform.replyAuto"), description: tr("mform.replyIrcv3") },
            { value: "modern", label: tr("mform.replyModern") },
            { value: "legacy", label: tr("mform.replyLegacy") },
            { value: "hybrid", label: tr("mform.replyHybrid"), description: tr("mform.replyBoth") },
          ]}
          onChange={(v) => set("replyMode", v as ServerReplyMode)}
          openPicker={openPicker}
          divider={isEdit}
        />
        {isEdit && (
          <>
            <M3SelectItem
              title={tr("mform.motd")}
              value={form.motdPolicy}
              options={[
                {
                  value: "default",
                  label: `Default (${
                    globalMotdPolicy === "always"
                      ? tr("mform.motdAlways")
                      : globalMotdPolicy === "never"
                        ? tr("mform.motdNever")
                        : tr("mform.motdWhenChanged")
                  })`,
                },
                { value: "on_change", label: tr("mform.motdWhenChanged") },
                { value: "always", label: tr("mform.motdAlways") },
                { value: "never", label: tr("mform.motdNeverServer") },
                { value: "never_globally", label: tr("mform.motdNeverAll") },
              ]}
              onChange={(v) => {
                if (v === "never_globally") setGlobalMotdPolicy("never");
                set("motdPolicy", v as ServerMotdDisplayPolicy);
              }}
              openPicker={openPicker}
            />
            <M3SelectItem
              title={tr("mform.displayName")}
              value={form.displayNameMode}
              options={[
                { value: "default", label: tr("mform.displayDefault") },
                { value: "nickname", label: tr("mform.nickname") },
                { value: "realname", label: tr("mform.realName") },
                { value: "username", label: tr("mform.username") },
              ]}
              onChange={(v) => set("displayNameMode", v as ServerUserDisplayNameMode)}
              openPicker={openPicker}
            />
            <M3SelectItem
              title={tr("mform.imagePreviews")}
              value={form.mediaCollapse}
              options={[
                {
                  value: "default",
                  label: `Default (${autoCollapseImages ? tr("mform.collapsed") : tr("mform.expanded")})`,
                },
                { value: "expanded", label: tr("mform.alwaysExpanded") },
                { value: "collapsed", label: tr("mform.alwaysCollapsed") },
              ]}
              onChange={(v) => set("mediaCollapse", v as ServerMediaCollapseMode)}
              openPicker={openPicker}
              divider={false}
            />
          </>
        )}
      </M3ListGroup>

      {isEdit && (
        <MobileNotificationOverrides
          mode="server"
          values={form.notifications}
          inherited={{
            channelNotifications:
              globalNotif?.channelNotifications === "all"
                ? tr("mform.allMessages")
                : globalNotif?.channelNotifications === "off"
                  ? tr("mform.off")
                  : tr("mform.mentionsOnly"),
            dmNotifications: globalNotif?.dmNotifications === "off" ? tr("mform.off") : tr("mform.allMessages"),
            sound: globalNotif?.soundEnabled ? tr("mform.on") : tr("mform.muted"),
            soundPreset: globalNotif?.soundPreset || "chime",
            dmSoundPreset: globalNotif?.dmSoundPreset || "chime",
            cooldownSec: ((globalNotif?.soundCooldownMs ?? 3000) / 1000).toString(),
            popup: globalNotif?.popupEnabled ? tr("mform.on") : tr("mform.off"),
          }}
          onChange={(field, value) => set("notifications", { ...form.notifications, [field]: value })}
          openPicker={openPicker}
        />
      )}

      <M3Subheader>{tr("mform.customCommands")}</M3Subheader>
      <Box sx={{ px: 0.5, pb: 1.5, fontSize: "0.875rem", lineHeight: "20px", color: t.onSurfaceVariant }}>
        {tr("mform.commandsDesc")} {tr("cb.stepsHint")}
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {form.customCommands.map((c, i) => (
          <M3Card key={i} variant="outlined">
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, p: 2, pt: 2.5 }}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <M3TextField
                    label={tr("mform.slashCommand")}
                    prefix="/"
                    value={c.trigger}
                    onChange={(v) => setCommand(i, "trigger", v.replace(/^\/*/, "").replace(/\s+/g, ""))}
                    placeholder={tr("mform.commandPlaceholder")}
                  />
                </Box>
                <M3IconButton
                  label={tr("mform.deleteCommand")}
                  icon={<DeleteOutlinedIcon />}
                  onClick={() =>
                    set(
                      "customCommands",
                      form.customCommands.filter((_, idx) => idx !== i)
                    )
                  }
                />
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {c.steps.map((step, k) => (
                  <Box key={k} sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box sx={{ flex: 1, fontSize: "0.75rem", fontWeight: 500, color: t.onSurfaceVariant }}>
                        {k + 1}. {tr(STEP_TYPES.find((o) => o.value === step.type)?.label ?? "cb.stepMessage")}
                      </Box>
                      {c.steps.length > 1 && (
                        <M3IconButton
                          label={tr("cb.removeStep")}
                          icon={<CloseIcon />}
                          onClick={() => setSteps(i, (steps) => steps.filter((_, idx) => idx !== k))}
                        />
                      )}
                    </Box>
                    {step.type === "message" && (
                      <M3TextField
                        label={tr("cb.stepMessage")}
                        value={step.text}
                        onChange={(v) => patchStep(i, k, { text: v })}
                        placeholder={tr("cb.stepMessagePlaceholder")}
                      />
                    )}
                    {step.type === "mention" && (
                      <>
                        <M3TextField
                          label={tr("cb.stepMentionTarget")}
                          value={step.target}
                          onChange={(v) => patchStep(i, k, { target: v.replace(/\s+/g, "") })}
                        />
                        <M3TextField
                          label={tr("cb.stepMentionText")}
                          value={step.text}
                          onChange={(v) => patchStep(i, k, { text: v })}
                        />
                      </>
                    )}
                    {step.type === "openUrl" && (
                      <M3TextField
                        label={tr("cb.stepOpenUrl")}
                        value={step.url}
                        onChange={(v) => patchStep(i, k, { url: v.trim() })}
                        placeholder={tr("cb.stepUrlPlaceholder")}
                        inputMode="url"
                      />
                    )}
                  </Box>
                ))}
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, alignItems: "center" }}>
                  <Box sx={{ fontSize: "0.75rem", color: t.onSurfaceVariant }}>{tr("cb.addStep")}:</Box>
                  {STEP_TYPES.map((o) => (
                    <M3Chip
                      key={o.value}
                      label={tr(o.label)}
                      icon={<AddIcon />}
                      onClick={() => setSteps(i, (steps) => [...steps, emptyFormStep(o.value)])}
                    />
                  ))}
                </Box>
              </Box>
              <M3Chip
                label={tr("cb.moreOptions")}
                tone={openOptions.has(i) ? "primary" : "neutral"}
                onClick={() =>
                  setOpenOptions((prev) => {
                    const next = new Set(prev);
                    if (next.has(i)) next.delete(i);
                    else next.add(i);
                    return next;
                  })
                }
              />
              {openOptions.has(i) && (
                <>
                  <M3TextField
                    label={tr("mform.description")}
                    value={c.description}
                    onChange={(v) => setCommand(i, "description", v)}
                    supportingText={tr("mform.shownAutocomplete")}
                  />
                  <M3TextField
                    label={tr("mform.suggestions")}
                    value={c.suggestions}
                    onChange={(v) => setCommand(i, "suggestions", v)}
                    placeholder={tr("mform.suggestionsPlaceholder")}
                    supportingText={tr("mform.commaArgs")}
                  />
                </>
              )}
            </Box>
          </M3Card>
        ))}
        {importError && (
          <Box sx={{ px: 0.5, fontSize: "0.75rem", color: t.error }}>{importError}</Box>
        )}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <M3Button
            variant="tonal"
            icon={<AddIcon />}
            onClick={() =>
              set("customCommands", [...form.customCommands, emptyFormCommand()])
            }
          >
            {tr("mform.addCommand")}
          </M3Button>
          <M3Button
            variant="outlined"
            icon={<FileOpenOutlinedIcon />}
            onClick={() => fileRef.current?.click()}
          >
            {tr("mform.loadJson")}
          </M3Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={handleImport}
          />
        </Box>
      </Box>
    </>
  );
};

/** Material 3 full-screen dialog for adding (create) or editing an IRC server on mobile. */
export const MobileServerFormModal = ({ mode }: { mode: "create" | "edit" }) => {
  const { t: tr } = useTranslation();
  const { isOpen, type, data, onClose } = useModal();
  const navigate = useNavigate();
  const isEdit = mode === "edit";
  const open = isOpen && type === (isEdit ? "editServer" : "createServer");

  const addServer = useMockStore((s) => s.addServer);
  const updateServer = useMockStore((s) => s.updateServer);
  const setServerMotdPolicy = useMockStore((s) => s.setServerMotdPolicy);
  const setServerMediaCollapsePolicy = useMockStore((s) => s.setServerMediaCollapsePolicy);
  const serverMotdPolicies = useMockStore((s) => s.serverMotdPolicies);
  const currentProfile = useMockStore((s) => s.currentProfile);
  const server = useMockStore((s) => s.servers.find((sv) => sv.id === data?.server?.id)) || data?.server;

  const picker = useM3Picker();
  const [form, setForm] = useState<FormState | null>(null);
  const [initial, setInitial] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  useEffect(() => {
    if (!open) {
      setForm(null);
      setSubmitted(false);
      setConfirmDiscard(false);
      return;
    }
    const n = server?.notificationSettings;
    const next: FormState =
      isEdit && server
        ? {
            imageUrl: server.imageUrl || "",
            name: server.name || "",
            host: server.host || "",
            port: String(server.port || 6667),
            password: server.password || "",
            useTls: server.useTls ?? false,
            nicknames: server.nicknames?.length ? [...server.nicknames] : [""],
            username: server.username || "",
            realname: server.realname || "",
            autoConnect: server.autoConnect ?? true,
            autoReconnect: server.autoReconnect ?? true,
            parseLegacyZncTimestamps: server.parseLegacyZncTimestamps ?? false,
            replyMode: (server.replyMode as ServerReplyMode) ?? "inherit",
            customCommands: (server.customCommands || []).map((c) => ({
              trigger: c.trigger,
              description: c.description || "",
              suggestions: (c.suggestions || []).join(", "),
              steps: toFormSteps(c),
            })),
            motdPolicy: serverMotdPolicies[server.id] || server.motdPolicy || "default",
            displayNameMode: server.displayNameMode || "default",
            mediaCollapse: server.autoCollapseImages || "default",
            notifications: {
              channelNotifications: n?.channelNotifications || "default",
              dmNotifications: n?.dmNotifications || "default",
              sound: n?.sound || "default",
              popup: n?.popup || "default",
              taskbar: n?.taskbar || "default",
              soundCooldown: n?.soundCooldown ?? "default",
              soundPreset: n?.soundPreset || "default",
              dmSoundPreset: n?.dmSoundPreset || "default",
              customSoundUrl: n?.customSoundUrl,
              customDmSoundUrl: n?.customDmSoundUrl,
            },
          }
        : {
            imageUrl: "",
            name: "",
            host: "",
            port: "6697",
            password: "",
            useTls: true,
            nicknames: [currentProfile.name.replace(/\s+/g, "") || ""],
            username: "",
            realname: "",
            autoConnect: true,
            autoReconnect: true,
            parseLegacyZncTimestamps: false,
            replyMode: "inherit",
            customCommands: [],
            motdPolicy: "default",
            displayNameMode: "default",
            mediaCollapse: "default",
            notifications: {},
          };
    setForm(next);
    setInitial(JSON.stringify(next));
    // Only reset when the dialog opens or targets another server
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, server?.id]);

  const set = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) =>
      setForm((f) => (f ? { ...f, [key]: value } : f)),
    []
  );

  const errors = useMemo(() => (form ? validate(form, tr) : {}), [form, tr]);
  const dirty = !!form && JSON.stringify(form) !== initial;

  const save = () => {
    if (!form) return;
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;

    const base = {
      imageUrl: form.imageUrl,
      name: form.name.trim(),
      host: form.host.trim(),
      port: Number(form.port),
      nicknames: form.nicknames.map((n) => n.trim()).filter(Boolean),
      username: form.username,
      realname: form.realname,
      password: form.password,
      useTls: form.useTls,
      autoConnect: form.autoConnect,
      autoReconnect: form.autoReconnect,
      parseLegacyZncTimestamps: form.parseLegacyZncTimestamps,
      replyMode: form.replyMode,
      customCommands: normalizeCustomCommandsFromForm(form.customCommands),
    };

    if (isEdit && server?.id) {
      updateServer(server.id, {
        ...base,
        motdPolicy: form.motdPolicy,
        displayNameMode: form.displayNameMode,
        autoCollapseImages: form.mediaCollapse,
        notificationSettings: form.notifications as any,
      });
      setServerMotdPolicy(server.id, form.motdPolicy);
      setServerMediaCollapsePolicy(server.id, form.mediaCollapse);
      onClose();
    } else {
      const created = addServer(base);
      onClose();
      navigate(`/servers/${created.id}`);
    }
  };

  const attemptClose = () => {
    if (picker.isOpen) picker.close();
    else if (confirmDiscard) setConfirmDiscard(false);
    else if (dirty) setConfirmDiscard(true);
    else onClose();
  };

  return (
    <M3FullScreenDialog
      open={open}
      title={isEdit ? tr("mform.editServer") : tr("mform.addServer")}
      onClose={attemptClose}
      action={{ label: isEdit ? tr("mform.save") : tr("mform.add"), onClick: save }}
    >
      {form && (
        <ServerFormBody
          form={form}
          set={set}
          errors={submitted ? errors : {}}
          isEdit={isEdit}
          openPicker={picker.open}
        />
      )}
      {picker.element}
      <M3Dialog
        open={confirmDiscard}
        title={tr("mform.discardQuestion")}
        supportingText={`You have unsaved changes${server?.name ? ` to ${server.name}` : ""}.`}
        onDismiss={() => setConfirmDiscard(false)}
        actions={
          <>
            <M3Button variant="text" onClick={() => setConfirmDiscard(false)}>
              {tr("mform.keepEditing")}
            </M3Button>
            <M3Button variant="text" onClick={() => onClose()}>
              Discard
            </M3Button>
          </>
        }
      />
    </M3FullScreenDialog>
  );
};
