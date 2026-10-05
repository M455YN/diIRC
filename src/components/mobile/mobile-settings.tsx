import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import PaletteOutlinedIcon from "@mui/icons-material/PaletteOutlined";
import ChatOutlinedIcon from "@mui/icons-material/ChatOutlined";
import LinkOutlinedIcon from "@mui/icons-material/LinkOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { useMobileBackHandler } from "@/hooks/use-mobile-back-handler";
import { useMobileThemeStore, type MobileThemeMode } from "@/hooks/use-mobile-theme";
import { useMockStore, formatMessageDate, formatNickCompletion } from "@/lib/mock-store";
import type { NickCompletionFormat, StatusDisplayMode } from "@/lib/mock-store";
import type {
  ChannelNotificationMode,
  DmNotificationMode,
  MotdDisplayPolicy,
  ReplyMode,
  UserDisplayNameMode,
} from "@/types";
import type { ImageUploadProvider, LitterboxTime } from "@/lib/upload/types";
import { playNotificationSound, type SoundPreset } from "@/lib/notification-sound";
import { requestDesktopNotificationPermission } from "@/lib/notification-service";
import {
  M3Button,
  M3ListItem,
  M3Provider,
  M3SearchBar,
  M3SelectDialog,
  M3Subheader,
  M3Switch,
  M3TextField,
  useM3,
  type M3Option,
} from "@/components/mobile/m3";

type SettingsCategory = "notifications" | "appearance" | "chat" | "previews" | "uploads" | "auth";

const CATEGORIES: {
  id: SettingsCategory;
  title: string;
  subtitle: string;
  icon: ReactNode;
}[] = [
  {
    id: "notifications",
    title: "Notifications",
    subtitle: "Mentions, direct messages, sounds",
    icon: <NotificationsOutlinedIcon />,
  },
  {
    id: "appearance",
    title: "Appearance",
    subtitle: "Theme, compact mode, names, dates",
    icon: <PaletteOutlinedIcon />,
  },
  {
    id: "chat",
    title: "Chat and messaging",
    subtitle: "Replies, commands, MOTD, sorting",
    icon: <ChatOutlinedIcon />,
  },
  {
    id: "previews",
    title: "Link previews",
    subtitle: "Images, web pages, preview API",
    icon: <LinkOutlinedIcon />,
  },
  {
    id: "uploads",
    title: "Image uploads",
    subtitle: "Litterbox, POMF",
    icon: <CloudUploadOutlinedIcon />,
  },
  {
    id: "auth",
    title: "Authorization",
    subtitle: "URL header rules for private hosts",
    icon: <VpnKeyOutlinedIcon />,
  },
];

const SEARCH_INDEX: { title: string; category: SettingsCategory }[] = [
  { title: "Theme", category: "appearance" },
  { title: "Dark theme", category: "appearance" },
  { title: "Pure black", category: "appearance" },
  { title: "Channel notifications", category: "notifications" },
  { title: "Direct message notifications", category: "notifications" },
  { title: "Notification sound", category: "notifications" },
  { title: "Channel sound", category: "notifications" },
  { title: "Direct message sound", category: "notifications" },
  { title: "Sound cooldown", category: "notifications" },
  { title: "Popup notifications", category: "notifications" },
  { title: "User display name", category: "appearance" },
  { title: "Compact mode", category: "appearance" },
  { title: "Markdown rendering", category: "appearance" },
  { title: "Formatting preview", category: "appearance" },
  { title: "Date format", category: "appearance" },
  { title: "Emoji size", category: "appearance" },
  { title: "Confirm before leaving channel", category: "chat" },
  { title: "Slash command suggestions", category: "chat" },
  { title: "Sort private messages by unread", category: "chat" },
  { title: "Private message sort order", category: "chat" },
  { title: "Connection status indicator", category: "chat" },
  { title: "Default reply format", category: "chat" },
  { title: "Nickname completion format", category: "chat" },
  { title: "Message of the day (MOTD)", category: "chat" },
  { title: "Link previews", category: "previews" },
  { title: "Web page previews", category: "previews" },
  { title: "Auto-collapse images", category: "previews" },
  { title: "MOTD media previews", category: "previews" },
  { title: "Link preview API URL", category: "previews" },
  { title: "Image upload provider", category: "uploads" },
  { title: "Litterbox expiration", category: "uploads" },
  { title: "POMF server URL", category: "uploads" },
  { title: "URL authorization rules", category: "auth" },
];

const SOUND_OPTIONS: M3Option[] = [
  { value: "chime", label: "Harmonic chime" },
  { value: "ping", label: "Crisp ping" },
  { value: "bell", label: "Warm bell" },
  { value: "pop", label: "Bubble pop" },
];

const COOLDOWN_OPTIONS: M3Option[] = [
  { value: "0", label: "No cooldown" },
  { value: "1000", label: "1 second" },
  { value: "2500", label: "2.5 seconds" },
  { value: "3000", label: "3 seconds" },
  { value: "5000", label: "5 seconds" },
  { value: "10000", label: "10 seconds" },
];

interface PickerState {
  title: string;
  options: M3Option[];
  value: string;
  onConfirm: (value: string) => void;
}

const labelFor = (options: M3Option[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

const Card = ({ children }: { children: ReactNode }) => {
  const t = useM3();
  return (
    <Box
      sx={{
        bgcolor: t.surfaceContainer,
        borderRadius: "24px",
        overflow: "hidden",
        mb: 2,
      }}
    >
      {children}
    </Box>
  );
};

const SettingsBody = ({ onClose }: { onClose: () => void }) => {
  const t = useM3();
  const [category, setCategory] = useState<SettingsCategory | null>(null);
  const [query, setQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [picker, setPicker] = useState<PickerState | null>(null);

  const store = useMockStore();
  const notificationSettings = store.notificationSettings || {
    soundEnabled: true,
    soundPreset: "chime" as SoundPreset,
    popupEnabled: true,
    taskbarHighlightEnabled: true,
  };
  const setNotif = store.setGlobalNotificationSettings;
  const themeMode = useMobileThemeStore((s) => s.mode);
  const setThemeMode = useMobileThemeStore((s) => s.setMode);
  const pureBlack = useMobileThemeStore((s) => s.pureBlack);
  const setPureBlack = useMobileThemeStore((s) => s.setPureBlack);

  const [newRulePrefix, setNewRulePrefix] = useState("");
  const [newRuleHeaderName, setNewRuleHeaderName] = useState("Authorization");
  const [newRuleHeaderValue, setNewRuleHeaderValue] = useState("");

  const handleBack = useCallback(() => {
    if (picker) setPicker(null);
    else if (category) setCategory(null);
    else if (searchActive) {
      setSearchActive(false);
      setQuery("");
      (document.activeElement as HTMLElement | null)?.blur?.();
    } else onClose();
  }, [picker, category, searchActive, onClose]);

  useMobileBackHandler(true, handleBack);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const catTitle = (id: SettingsCategory) => CATEGORIES.find((c) => c.id === id)!.title;
    return [
      ...CATEGORIES.filter((c) => c.title.toLowerCase().includes(q)).map((c) => ({
        title: c.title,
        category: c.id,
        context: "Category",
      })),
      ...SEARCH_INDEX.filter((i) => i.title.toLowerCase().includes(q)).map((i) => ({
        ...i,
        context: catTitle(i.category),
      })),
    ];
  }, [query]);

  const openCategory = (id: SettingsCategory) => {
    setSearchActive(false);
    setQuery("");
    setCategory(id);
  };

  const select = (
    title: string,
    value: string,
    options: M3Option[],
    onChange: (v: string) => void,
    divider = true
  ) => (
    <M3ListItem
      headline={title}
      supporting={labelFor(options, value)}
      divider={divider}
      onClick={() => setPicker({ title, options, value, onConfirm: onChange })}
    />
  );

  const toggle = (
    title: string,
    checked: boolean,
    onChange: (v: boolean) => void,
    supporting?: string,
    divider = true
  ) => (
    <M3ListItem
      headline={title}
      supporting={supporting}
      divider={divider}
      onClick={() => onChange(!checked)}
      trailing={<M3Switch checked={checked} onChange={onChange} ariaLabel={title} />}
    />
  );

  const fieldBox = (children: ReactNode) => <Box sx={{ px: 2.5, py: 2 }}>{children}</Box>;

  const renderDetail = () => {
    switch (category) {
      case "notifications":
        return (
          <>
            <M3Subheader>Alerts</M3Subheader>
            <Card>
              {select(
                "Channel notifications",
                notificationSettings.channelNotifications || "mentions",
                [
                  { value: "mentions", label: "Mentions only" },
                  { value: "all", label: "All messages" },
                  { value: "off", label: "Off" },
                ],
                (v) => setNotif({ channelNotifications: v as ChannelNotificationMode })
              )}
              {select(
                "Direct message notifications",
                notificationSettings.dmNotifications || "all",
                [
                  { value: "all", label: "All messages" },
                  { value: "off", label: "Off" },
                ],
                (v) => setNotif({ dmNotifications: v as DmNotificationMode })
              )}
              {toggle(
                "Popup notifications",
                notificationSettings.popupEnabled,
                (v) => {
                  setNotif({ popupEnabled: v });
                  if (v) void requestDesktopNotificationPermission();
                },
                "Show a system notification for new alerts",
                false
              )}
            </Card>

            <M3Subheader>Sound</M3Subheader>
            <Card>
              {toggle(
                "Notification sound",
                notificationSettings.soundEnabled,
                (v) => setNotif({ soundEnabled: v }),
                undefined,
                notificationSettings.soundEnabled
              )}
              {notificationSettings.soundEnabled && (
                <>
                  {select(
                    "Channel sound",
                    notificationSettings.soundPreset === "custom"
                      ? "custom"
                      : notificationSettings.soundPreset || "chime",
                    notificationSettings.soundPreset === "custom"
                      ? [...SOUND_OPTIONS, { value: "custom", label: "Custom file" }]
                      : SOUND_OPTIONS,
                    (v) => setNotif({ soundPreset: v as SoundPreset })
                  )}
                  {select(
                    "Direct message sound",
                    notificationSettings.dmSoundPreset || "chime",
                    notificationSettings.dmSoundPreset === "custom"
                      ? [...SOUND_OPTIONS, { value: "custom", label: "Custom file" }]
                      : SOUND_OPTIONS,
                    (v) => setNotif({ dmSoundPreset: v as SoundPreset })
                  )}
                  {select(
                    "Sound cooldown",
                    String(notificationSettings.soundCooldownMs ?? 3000),
                    COOLDOWN_OPTIONS.some(
                      (o) => o.value === String(notificationSettings.soundCooldownMs ?? 3000)
                    )
                      ? COOLDOWN_OPTIONS
                      : [
                          ...COOLDOWN_OPTIONS,
                          {
                            value: String(notificationSettings.soundCooldownMs),
                            label: `${(notificationSettings.soundCooldownMs ?? 0) / 1000} seconds`,
                          },
                        ],
                    (v) => setNotif({ soundCooldownMs: Number(v) }),
                    false
                  )}
                  <Box sx={{ px: 2.5, pb: 2 }}>
                    <M3Button
                      variant="tonal"
                      icon={<PlayArrowOutlinedIcon />}
                      onClick={() =>
                        playNotificationSound(
                          notificationSettings.soundPreset || "chime",
                          notificationSettings.customSoundUrl
                        )
                      }
                    >
                      Play sound
                    </M3Button>
                  </Box>
                </>
              )}
            </Card>
          </>
        );

      case "appearance":
        return (
          <>
            <M3Subheader>Theme</M3Subheader>
            <Card>
              {select(
                "Theme",
                themeMode,
                [
                  { value: "system", label: "System default", description: "Follow the phone's dark theme setting" },
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                ],
                (v) => setThemeMode(v as MobileThemeMode)
              )}
              {toggle(
                "Pure black",
                pureBlack,
                setPureBlack,
                "Use black backgrounds in dark theme to save power on OLED screens",
                false
              )}
            </Card>

            <M3Subheader>Display</M3Subheader>
            <Card>
              {select(
                "User display name",
                store.userDisplayNameMode || "nickname",
                [
                  { value: "nickname", label: "Nickname" },
                  { value: "realname", label: "Real name", description: "Falls back to nickname" },
                  { value: "username", label: "Username", description: "Falls back to nickname" },
                ],
                (v) => store.setUserDisplayNameMode(v as UserDisplayNameMode)
              )}
              {toggle(
                "Compact mode",
                store.compactMode,
                store.setCompactMode,
                "Hide avatars in the chat window"
              )}
              {toggle(
                "Markdown rendering",
                store.enableMarkdown ?? true,
                store.setEnableMarkdown,
                "Bold, italic, code, spoilers, and links"
              )}
              {toggle(
                "Formatting preview",
                store.enableFormattingPreview ?? true,
                store.setEnableFormattingPreview,
                "Live preview above the composer",
                false
              )}
            </Card>

            <M3Subheader>Dates and emoji</M3Subheader>
            <Card>
              {select(
                "Date format",
                store.dateFormatPreset || "d MMM yyyy, HH:mm",
                [
                  "d MMM yyyy, HH:mm",
                  "yyyy-MM-dd HH:mm",
                  "MM/dd/yyyy hh:mm a",
                  "dd.MM.yyyy HH:mm",
                ]
                  .map((f) => ({ value: f, label: formatMessageDate(new Date(), f, "") }))
                  .concat({ value: "custom", label: "Custom format" }),
                store.setDateFormatPreset,
                store.dateFormatPreset !== "custom"
              )}
              {store.dateFormatPreset === "custom" &&
                fieldBox(
                  <M3TextField
                    label="Custom date format"
                    value={store.customDateFormat || ""}
                    onChange={store.setCustomDateFormat}
                    placeholder="yyyy/MM/dd HH:mm"
                    monospace
                    labelBackground={t.surfaceContainer}
                    supportingText={`Preview: ${formatMessageDate(
                      new Date(),
                      "custom",
                      store.customDateFormat || "yyyy/MM/dd HH:mm"
                    )}`}
                  />
                )}
              {select(
                "Emoji size",
                String(store.jumbojiSize ?? 42),
                [
                  { value: "0", label: "Disabled" },
                  { value: "32", label: "Small" },
                  { value: "42", label: "Default" },
                  { value: "56", label: "Large" },
                ],
                (v) => store.setJumbojiSize(Number(v)),
                false
              )}
            </Card>
          </>
        );

      case "chat": {
        const nickOptions: M3Option[] = (
          ["plain", "colon", "comma", "at", "arrow", "hyphen", "bracket"] as NickCompletionFormat[]
        )
          .map((f) => ({ value: f, label: formatNickCompletion("Alice", f).trimEnd() }))
          .concat({ value: "custom", label: "Custom format" });
        return (
          <>
            <M3Subheader>Behavior</M3Subheader>
            <Card>
              {toggle(
                "Confirm before leaving channel",
                store.confirmLeaveChannel ?? true,
                store.setConfirmLeaveChannel
              )}
              {toggle(
                "Slash command suggestions",
                store.enableCommandSuggestions ?? true,
                store.setEnableCommandSuggestions
              )}
              {select(
                "Default reply format",
                store.defaultReplyMode || "auto",
                [
                  {
                    value: "auto",
                    label: "Auto",
                    description: "IRCv3 tags when supported, otherwise inline quote",
                  },
                  { value: "modern", label: "Modern IRCv3 only" },
                  { value: "legacy", label: "Legacy inline only" },
                  { value: "hybrid", label: "Hybrid", description: "Both formats" },
                ],
                (v) => store.setDefaultReplyMode(v as ReplyMode)
              )}
              {select(
                "Nickname completion format",
                store.nickCompletionFormat || "plain",
                nickOptions,
                (v) => store.setNickCompletionFormat(v as NickCompletionFormat),
                store.nickCompletionFormat !== "custom"
              )}
              {store.nickCompletionFormat === "custom" &&
                fieldBox(
                  <M3TextField
                    label="Custom pattern"
                    value={store.customNickCompletionFormat || ""}
                    onChange={store.setCustomNickCompletionFormat}
                    placeholder="{nick}: "
                    monospace
                    labelBackground={t.surfaceContainer}
                    supportingText={`Preview: ${formatNickCompletion(
                      "Alice",
                      "custom",
                      store.customNickCompletionFormat || "{nick}: "
                    )}hello there!`}
                  />
                )}
              {select(
                "Message of the day (MOTD)",
                store.globalMotdPolicy || "on_change",
                [
                  { value: "on_change", label: "When changed" },
                  { value: "always", label: "Always" },
                  { value: "never", label: "Never" },
                ],
                (v) => store.setGlobalMotdPolicy(v as MotdDisplayPolicy),
                false
              )}
            </Card>

            <M3Subheader>Lists</M3Subheader>
            <Card>
              {toggle(
                "Sort private messages by unread",
                store.sortDmByUnread ?? true,
                store.setSortDmByUnread
              )}
              {select(
                "Private message sort order",
                store.dmSortOrder ?? "opening",
                [
                  { value: "opening", label: "By opening order" },
                  { value: "alphabetical", label: "Alphabetical" },
                ],
                (v) => store.setDmSortOrder(v as "opening" | "alphabetical")
              )}
              {select(
                "Connection status indicator",
                store.statusDisplayMode || "always",
                [
                  { value: "always", label: "Always show" },
                  { value: "on_error", label: "Only on error" },
                  { value: "disabled", label: "Hidden" },
                ],
                (v) => store.setStatusDisplayMode(v as StatusDisplayMode),
                false
              )}
            </Card>
          </>
        );
      }

      case "previews":
        return (
          <Card>
            {toggle(
              "Link previews",
              store.enableLinkPreviews,
              store.setEnableLinkPreviews,
              "Show embeds for links in chat"
            )}
            {toggle("Web page previews", store.enableWebPagePreviews, store.setEnableWebPagePreviews)}
            {toggle(
              "Auto-collapse images",
              store.autoCollapseImages ?? false,
              store.setAutoCollapseImages
            )}
            {toggle(
              "MOTD media previews",
              store.enableMotdMediaPreviews ?? false,
              store.setEnableMotdMediaPreviews
            )}
            {fieldBox(
              <M3TextField
                label="Link preview API URL"
                value={store.linkPreviewApiUrl || ""}
                onChange={store.setLinkPreviewApiUrl}
                placeholder="https://…"
                labelBackground={t.surfaceContainer}
              />
            )}
          </Card>
        );

      case "uploads": {
        const cfg = store.uploadConfig;
        return (
          <Card>
            {select(
              "Image upload provider",
              cfg.provider,
              [
                { value: "disabled", label: "Disabled" },
                {
                  value: "litterbox",
                  label: "Litterbox",
                  description: "Public, expires after 1–72 hours",
                },
                { value: "pomf", label: "POMF", description: "Custom POMF-compatible server" },
              ],
              (v) => store.setUploadConfig({ ...cfg, provider: v as ImageUploadProvider }),
              cfg.provider !== "disabled"
            )}
            {cfg.provider === "litterbox" &&
              select(
                "Litterbox expiration",
                cfg.litterboxTime || "1h",
                [
                  { value: "1h", label: "1 hour" },
                  { value: "12h", label: "12 hours" },
                  { value: "24h", label: "24 hours" },
                  { value: "72h", label: "72 hours" },
                ],
                (v) => store.setUploadConfig({ ...cfg, litterboxTime: v as LitterboxTime }),
                false
              )}
            {cfg.provider === "pomf" &&
              fieldBox(
                <M3TextField
                  label="POMF server URL"
                  value={cfg.pomfUrl || ""}
                  onChange={(v) => store.setUploadConfig({ ...cfg, pomfUrl: v })}
                  placeholder="https://…"
                  labelBackground={t.surfaceContainer}
                />
              )}
          </Card>
        );
      }

      case "auth":
        return (
          <>
            <Box sx={{ px: 1, pb: 1.5, fontSize: "0.875rem", color: t.onSurfaceVariant }}>
              Add header rules for private image hosts that require authorization.
            </Box>
            <M3Subheader>Rules</M3Subheader>
            <Card>
              {store.urlAuthRules.length === 0 ? (
                <M3ListItem headline="No rules configured" />
              ) : (
                store.urlAuthRules.map((rule, i) => (
                  <M3ListItem
                    key={rule.id}
                    headline={
                      <Box component="span" sx={{ fontFamily: "ui-monospace, monospace" }}>
                        {rule.urlPrefix}
                      </Box>
                    }
                    supporting={`${rule.headerName}: ${"•".repeat(8)}`}
                    divider={i < store.urlAuthRules.length - 1}
                    trailing={
                      <ButtonBase
                        aria-label="Delete rule"
                        onClick={() => store.removeUrlAuthRule(rule.id)}
                        sx={{ width: 40, height: 40, borderRadius: "50%", color: t.onSurfaceVariant }}
                      >
                        <DeleteOutlineIcon />
                      </ButtonBase>
                    }
                  />
                ))
              )}
            </Card>
            <M3Subheader>New rule</M3Subheader>
            <Card>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, px: 2.5, pt: 2.5, pb: 2 }}>
                <M3TextField
                  label="URL prefix"
                  value={newRulePrefix}
                  onChange={setNewRulePrefix}
                  placeholder="https://img.example.com/"
                  labelBackground={t.surfaceContainer}
                />
                <M3TextField
                  label="Header name"
                  value={newRuleHeaderName}
                  onChange={setNewRuleHeaderName}
                  monospace
                  labelBackground={t.surfaceContainer}
                />
                <M3TextField
                  label="Header value"
                  value={newRuleHeaderValue}
                  onChange={setNewRuleHeaderValue}
                  monospace
                  labelBackground={t.surfaceContainer}
                />
                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <M3Button
                    variant="filled"
                    icon={<AddIcon />}
                    disabled={!newRulePrefix || !newRuleHeaderName || !newRuleHeaderValue}
                    onClick={() => {
                      store.addUrlAuthRule({
                        urlPrefix: newRulePrefix,
                        headerName: newRuleHeaderName,
                        headerValue: newRuleHeaderValue,
                      });
                      setNewRulePrefix("");
                      setNewRuleHeaderValue("");
                    }}
                  >
                    Add rule
                  </M3Button>
                </Box>
              </Box>
            </Card>
          </>
        );

      default:
        return null;
    }
  };

  const activeCategory = CATEGORIES.find((c) => c.id === category);

  return (
    <Box
      sx={{
        position: "relative",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: t.surface,
        color: t.onSurface,
        fontFamily: "Roboto, system-ui, sans-serif",
      }}
    >
      {/* Top app bar — small when in a category, large title on the root */}
      {!searchActive && (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, px: 0.5, height: 64 }}>
          <ButtonBase
            aria-label="Back"
            onClick={handleBack}
            sx={{ width: 48, height: 48, borderRadius: "50%", color: t.onSurface }}
          >
            <ArrowBackIcon />
          </ButtonBase>
          {category && (
            <DialogTitle asChild>
              <Box component="h2" sx={{ m: 0, fontSize: "1.375rem", fontWeight: 400, lineHeight: "28px" }}>
                {activeCategory?.title}
              </Box>
            </DialogTitle>
          )}
        </Box>
      )}

      {!category && !searchActive && (
        <DialogTitle asChild>
          <Box
            component="h1"
            sx={{ m: 0, px: 2.5, pt: 1, pb: 3, fontSize: "2.25rem", fontWeight: 400, lineHeight: "44px" }}
          >
            Settings
          </Box>
        </DialogTitle>
      )}

      {!category && (
        <Box sx={{ px: 2, pb: 2, pt: searchActive ? 1 : 0 }}>
          <M3SearchBar
            value={query}
            onChange={setQuery}
            placeholder="Search settings"
            active={searchActive}
            onActiveChange={setSearchActive}
          />
        </Box>
      )}

      <Box sx={{ flex: 1, overflowY: "auto", px: 2, pb: 3 }}>
        {category ? (
          renderDetail()
        ) : searchActive ? (
          query.trim() ? (
            results.length > 0 ? (
              <Card>
                {results.map((r, i) => (
                  <M3ListItem
                    key={`${r.category}-${r.title}`}
                    headline={r.title}
                    supporting={r.context}
                    divider={i < results.length - 1}
                    onClick={() => openCategory(r.category)}
                  />
                ))}
              </Card>
            ) : (
              <Box sx={{ py: 6, textAlign: "center", color: t.onSurfaceVariant }}>
                No matching settings
              </Box>
            )
          ) : null
        ) : (
          <Card>
            {CATEGORIES.map((c, i) => (
              <M3ListItem
                key={c.id}
                leading={c.icon}
                headline={c.title}
                supporting={c.subtitle}
                divider={i < CATEGORIES.length - 1}
                onClick={() => openCategory(c.id)}
              />
            ))}
          </Card>
        )}
      </Box>

      <M3SelectDialog
        open={!!picker}
        title={picker?.title ?? ""}
        options={picker?.options ?? []}
        value={picker?.value ?? ""}
        onDismiss={() => setPicker(null)}
        onConfirm={(v) => {
          picker?.onConfirm(v);
          setPicker(null);
        }}
      />
    </Box>
  );
};

/**
 * Material Design 3 settings hub (Android Settings-style categories).
 */
export const MobileSettingsModal = () => {
  const { isOpen, onClose, type } = useModal();
  const isModalOpen = isOpen && type === "settings";

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideClose
        aria-describedby={undefined}
        className="grid-rows-[minmax(0,1fr)] overflow-hidden border-0 p-0 shadow-none"
      >
        <M3Provider>{isModalOpen && <SettingsBody onClose={onClose} />}</M3Provider>
      </DialogContent>
    </Dialog>
  );
};
