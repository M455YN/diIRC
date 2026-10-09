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
import type { NotificationSettingsValues } from "@/components/notifications/notification-settings-fields";
import { MobileNotificationOverrides } from "@/components/mobile/mobile-notification-overrides";
import {
  M3Button,
  M3Card,
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

interface CommandRow {
  trigger: string;
  message: string;
  description: string;
  suggestions: string;
}

interface FormState {
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

function validate(f: FormState): Errors {
  const errors: Errors = {};
  if (!f.name.trim()) errors.name = "Server name is required.";
  if (!f.host.trim()) errors.host = "Server address is required.";
  const port = Number(f.port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) errors.port = "Port must be 1–65535.";
  f.nicknames.forEach((n, i) => {
    if (i === 0 && !n.trim()) errors[`nick${i}`] = "Nickname is required.";
    else if (/\s/.test(n)) errors[`nick${i}`] = "Nickname cannot contain spaces.";
  });
  return errors;
}

const REPLY_LABELS: Record<ReplyMode, string> = {
  auto: "Auto",
  modern: "Modern IRCv3 only",
  legacy: "Legacy inline only",
  hybrid: "Hybrid",
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
  const t = useM3();
  const [showPassword, setShowPassword] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const globalNotif = useMockStore((s) => s.notificationSettings);
  const globalMotdPolicy = useMockStore((s) => s.globalMotdPolicy) || "on_change";
  const autoCollapseImages = useMockStore((s) => s.autoCollapseImages ?? false);
  const defaultReplyMode = useMockStore((s) => s.defaultReplyMode) || "auto";
  const setGlobalMotdPolicy = useMockStore((s) => s.setGlobalMotdPolicy);

  const setCommand = (i: number, key: keyof CommandRow, value: string) =>
    set(
      "customCommands",
      form.customCommands.map((c, idx) => (idx === i ? { ...c, [key]: value } : c))
    );

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImportError(null);
    try {
      set("customCommands", parseCustomCommandsJson(JSON.parse(await file.text())));
    } catch (err: any) {
      setImportError(
        err instanceof SyntaxError ? "Invalid JSON file." : err?.message || "Failed to load commands."
      );
    }
  };

  const fields = { display: "flex", flexDirection: "column", gap: 3, px: 0.5, pt: 1.5, pb: 1 } as const;

  return (
    <>
      <M3Subheader>Connection</M3Subheader>
      <Box sx={fields}>
        <M3TextField
          label="Server name"
          value={form.name}
          onChange={(v) => set("name", v)}
          placeholder="e.g. Libera Chat"
          error={errors.name}
        />
        <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
          <Box sx={{ flex: 2.2, minWidth: 0 }}>
            <M3TextField
              label="Host"
              value={form.host}
              inputMode="url"
              onChange={(v) => {
                if (v.includes(":")) {
                  const [h, p] = v.split(":");
                  set("host", h);
                  if (p) set("port", p.replace(/\D/g, ""));
                } else set("host", v);
              }}
              placeholder="irc.libera.chat"
              error={errors.host}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <M3TextField
              label="Port"
              value={form.port}
              inputMode="numeric"
              onChange={(v) => set("port", v.replace(/\D/g, ""))}
              error={errors.port}
            />
          </Box>
        </Box>
        <M3TextField
          label="Server password"
          value={form.password}
          type={showPassword ? "text" : "password"}
          onChange={(v) => set("password", v)}
          supportingText="Optional"
          trailing={
            <M3IconButton
              label={showPassword ? "Hide password" : "Show password"}
              icon={showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
              onClick={() => setShowPassword((s) => !s)}
            />
          }
        />
      </Box>
      <Box sx={{ mt: 1 }}>
        <M3ListGroup>
          <M3SwitchItem
            title="Use TLS"
            supporting="Encrypted connection, usually on port 6697"
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

      <M3Subheader>Identity</M3Subheader>
      <Box sx={fields}>
        {form.nicknames.map((nick, i) => (
          <M3TextField
            key={i}
            label={i === 0 ? "Nickname" : `Fallback nickname ${i}`}
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
                  label="Remove nickname"
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
            Add fallback nickname
          </M3Button>
        </Box>
        <M3TextField
          label="Username"
          value={form.username}
          onChange={(v) => set("username", v)}
          supportingText="Ident; defaults to the primary nickname"
        />
        <M3TextField
          label="Real name"
          value={form.realname}
          onChange={(v) => set("realname", v)}
          supportingText="Optional"
        />
      </Box>

      <M3Subheader>Behavior</M3Subheader>
      <M3ListGroup>
        <M3SwitchItem
          title="Auto-connect on startup"
          checked={form.autoConnect}
          onChange={(v) => set("autoConnect", v)}
        />
        <M3SwitchItem
          title="Auto-reconnect"
          supporting="Reconnect when the connection drops"
          checked={form.autoReconnect}
          onChange={(v) => set("autoReconnect", v)}
        />
        <M3SwitchItem
          title="Parse legacy ZNC timestamps"
          supporting="Read [HH:MM:SS] prefixes from bouncers without server-time"
          checked={form.parseLegacyZncTimestamps}
          onChange={(v) => set("parseLegacyZncTimestamps", v)}
        />
        <M3SelectItem
          title="Reply format"
          value={form.replyMode}
          options={[
            { value: "inherit", label: `Default (${REPLY_LABELS[defaultReplyMode]})` },
            { value: "auto", label: "Auto", description: "IRCv3 tags when supported" },
            { value: "modern", label: "Modern IRCv3 only" },
            { value: "legacy", label: "Legacy inline only" },
            { value: "hybrid", label: "Hybrid", description: "Both formats" },
          ]}
          onChange={(v) => set("replyMode", v as ServerReplyMode)}
          openPicker={openPicker}
          divider={isEdit}
        />
        {isEdit && (
          <>
            <M3SelectItem
              title="Message of the day (MOTD)"
              value={form.motdPolicy}
              options={[
                {
                  value: "default",
                  label: `Default (${
                    globalMotdPolicy === "always"
                      ? "Always"
                      : globalMotdPolicy === "never"
                        ? "Never"
                        : "When changed"
                  })`,
                },
                { value: "on_change", label: "When changed" },
                { value: "always", label: "Always" },
                { value: "never", label: "Never on this server" },
                { value: "never_globally", label: "Never on any server" },
              ]}
              onChange={(v) => {
                if (v === "never_globally") setGlobalMotdPolicy("never");
                set("motdPolicy", v as ServerMotdDisplayPolicy);
              }}
              openPicker={openPicker}
            />
            <M3SelectItem
              title="User display name"
              value={form.displayNameMode}
              options={[
                { value: "default", label: "Default (app setting)" },
                { value: "nickname", label: "Nickname" },
                { value: "realname", label: "Real name" },
                { value: "username", label: "Username" },
              ]}
              onChange={(v) => set("displayNameMode", v as ServerUserDisplayNameMode)}
              openPicker={openPicker}
            />
            <M3SelectItem
              title="Image previews"
              value={form.mediaCollapse}
              options={[
                {
                  value: "default",
                  label: `Default (${autoCollapseImages ? "Collapsed" : "Expanded"})`,
                },
                { value: "expanded", label: "Always expanded" },
                { value: "collapsed", label: "Always collapsed" },
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
                ? "All messages"
                : globalNotif?.channelNotifications === "off"
                  ? "Off"
                  : "Mentions only",
            dmNotifications: globalNotif?.dmNotifications === "off" ? "Off" : "All messages",
            sound: globalNotif?.soundEnabled ? "On" : "Muted",
            soundPreset: globalNotif?.soundPreset || "chime",
            dmSoundPreset: globalNotif?.dmSoundPreset || "chime",
            cooldownSec: ((globalNotif?.soundCooldownMs ?? 3000) / 1000).toString(),
            popup: globalNotif?.popupEnabled ? "On" : "Off",
          }}
          onChange={(field, value) => set("notifications", { ...form.notifications, [field]: value })}
          openPicker={openPicker}
        />
      )}

      <M3Subheader>Custom commands</M3Subheader>
      <Box sx={{ px: 0.5, pb: 1.5, fontSize: "0.875rem", lineHeight: "20px", color: t.onSurfaceVariant }}>
        Map a slash command to chat text. Arguments are appended automatically.
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {form.customCommands.map((c, i) => (
          <M3Card key={i} variant="outlined">
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, p: 2, pt: 2.5 }}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <M3TextField
                    label="Slash command"
                    prefix="/"
                    value={c.trigger}
                    onChange={(v) => setCommand(i, "trigger", v.replace(/^\/*/, "").replace(/\s+/g, ""))}
                    placeholder="command"
                  />
                </Box>
                <M3IconButton
                  label="Delete command"
                  icon={<DeleteOutlinedIcon />}
                  onClick={() =>
                    set(
                      "customCommands",
                      form.customCommands.filter((_, idx) => idx !== i)
                    )
                  }
                />
              </Box>
              <M3TextField
                label="Sends as"
                value={c.message}
                onChange={(v) => setCommand(i, "message", v)}
                placeholder="!command"
              />
              <M3TextField
                label="Description"
                value={c.description}
                onChange={(v) => setCommand(i, "description", v)}
                supportingText="Shown in autocomplete"
              />
              <M3TextField
                label="Suggestions"
                value={c.suggestions}
                onChange={(v) => setCommand(i, "suggestions", v)}
                placeholder="option1, option2"
                supportingText="Comma-separated arguments"
              />
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
              set("customCommands", [
                ...form.customCommands,
                { trigger: "", message: "", description: "", suggestions: "" },
              ])
            }
          >
            Add command
          </M3Button>
          <M3Button
            variant="outlined"
            icon={<FileOpenOutlinedIcon />}
            onClick={() => fileRef.current?.click()}
          >
            Load from JSON
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
              message: c.message,
              description: c.description || "",
              suggestions: (c.suggestions || []).join(", "),
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

  const errors = useMemo(() => (form ? validate(form) : {}), [form]);
  const dirty = !!form && JSON.stringify(form) !== initial;

  const save = () => {
    if (!form) return;
    setSubmitted(true);
    if (Object.keys(errors).length > 0) return;

    const base = {
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
      title={isEdit ? "Edit server" : "Add server"}
      onClose={attemptClose}
      action={{ label: isEdit ? "Save" : "Add", onClick: save }}
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
        title="Discard changes?"
        supportingText={`You have unsaved changes${server?.name ? ` to ${server.name}` : ""}.`}
        onDismiss={() => setConfirmDiscard(false)}
        actions={
          <>
            <M3Button variant="text" onClick={() => setConfirmDiscard(false)}>
              Keep editing
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
