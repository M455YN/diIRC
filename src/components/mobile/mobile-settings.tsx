import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLanguageStore, type AppLanguage } from "@/hooks/use-language-store";
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
    title: "mobile.cat.notifications",
    subtitle: "mobile.cat.notificationsSub",
    icon: <NotificationsOutlinedIcon />,
  },
  {
    id: "appearance",
    title: "mobile.cat.appearance",
    subtitle: "mobile.cat.appearanceSub",
    icon: <PaletteOutlinedIcon />,
  },
  {
    id: "chat",
    title: "mobile.cat.chat",
    subtitle: "mobile.cat.chatSub",
    icon: <ChatOutlinedIcon />,
  },
  {
    id: "previews",
    title: "mobile.cat.previews",
    subtitle: "mobile.cat.previewsSub",
    icon: <LinkOutlinedIcon />,
  },
  {
    id: "uploads",
    title: "mobile.cat.uploads",
    subtitle: "mobile.cat.uploadsSub",
    icon: <CloudUploadOutlinedIcon />,
  },
  {
    id: "auth",
    title: "mobile.cat.auth",
    subtitle: "mobile.cat.authSub",
    icon: <VpnKeyOutlinedIcon />,
  },
];

const SEARCH_INDEX: { title: string; category: SettingsCategory }[] = [
  { title: "mobile.search.theme", category: "appearance" },
  { title: "mobile.search.darkTheme", category: "appearance" },
  { title: "mobile.search.pureBlack", category: "appearance" },
  { title: "mobile.search.channelNotifications", category: "notifications" },
  { title: "mobile.search.dmNotifications", category: "notifications" },
  { title: "mobile.search.notificationSound", category: "notifications" },
  { title: "mobile.search.channelSound", category: "notifications" },
  { title: "mobile.search.dmSound", category: "notifications" },
  { title: "mobile.search.soundCooldown", category: "notifications" },
  { title: "mobile.search.popupNotifications", category: "notifications" },
  { title: "mobile.search.userDisplayName", category: "appearance" },
  { title: "mobile.search.groupByRole", category: "appearance" },
  { title: "mobile.search.markdown", category: "chat" },
  { title: "mobile.search.scrollOnReturn", category: "chat" },
  { title: "mobile.search.formattingPreview", category: "chat" },
  { title: "mobile.search.dateFormat", category: "appearance" },
  { title: "mobile.search.emojiSize", category: "chat" },
  { title: "mobile.search.confirmLeave", category: "chat" },
  { title: "mobile.search.slashSuggestions", category: "chat" },
  { title: "mobile.search.sortDmUnread", category: "appearance" },
  { title: "mobile.search.dmSortOrder", category: "appearance" },
  { title: "mobile.search.statusIndicator", category: "appearance" },
  { title: "mobile.search.defaultReplyFormat", category: "chat" },
  { title: "mobile.search.nickCompletion", category: "chat" },
  { title: "mobile.search.motd", category: "chat" },
  { title: "mobile.cat.previews", category: "previews" },
  { title: "mobile.search.webPreviews", category: "previews" },
  { title: "mobile.search.autoCollapse", category: "previews" },
  { title: "mobile.search.motdMedia", category: "previews" },
  { title: "mobile.search.previewApi", category: "previews" },
  { title: "mobile.search.uploadProvider", category: "uploads" },
  { title: "mobile.search.litterboxExpiration", category: "uploads" },
  { title: "mobile.search.pomfUrl", category: "uploads" },
  { title: "mobile.search.urlRules", category: "auth" },
];

const SOUND_OPTIONS: M3Option[] = [
  { value: "chime", label: "mobile.sound.chime" },
  { value: "ping", label: "mobile.sound.ping" },
  { value: "bell", label: "mobile.sound.bell" },
  { value: "pop", label: "mobile.sound.pop" },
  { value: "marimba", label: "mobile.sound.marimba" },
  { value: "glass", label: "mobile.sound.glass" },
];

const COOLDOWN_OPTIONS: M3Option[] = [
  { value: "0", label: "mobile.cooldown.none" },
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
  const { t: tr } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const categories = CATEGORIES.map((c) => ({ ...c, title: tr(c.title), subtitle: tr(c.subtitle) }));
  const searchIndex = SEARCH_INDEX.map((i) => ({ ...i, title: tr(i.title) }));
  const soundOptions = SOUND_OPTIONS.map((o) => ({ ...o, label: tr(o.label) }));
  const cooldownOptions = COOLDOWN_OPTIONS.map((o) => ({ ...o, label: tr(o.label) }));
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
    const catTitle = (id: SettingsCategory) => categories.find((c) => c.id === id)!.title;
    return [
      ...categories.filter((c) => c.title.toLowerCase().includes(q)).map((c) => ({
        title: c.title,
        category: c.id,
        context: tr("mobile.search.category"),
      })),
      ...searchIndex.filter((i) => i.title.toLowerCase().includes(q)).map((i) => ({
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
            <M3Subheader>{tr("mobile.alerts")}</M3Subheader>
            <Card>
              {select(
                tr("mobile.search.channelNotifications"),
                notificationSettings.channelNotifications || "mentions",
                [
                  { value: "mentions", label: tr("mobile.mentionsOnly") },
                  { value: "all", label: tr("mobile.allMessages") },
                  { value: "off", label: tr("mobile.off") },
                ],
                (v) => setNotif({ channelNotifications: v as ChannelNotificationMode })
              )}
              {select(
                tr("mobile.search.dmNotifications"),
                notificationSettings.dmNotifications || "all",
                [
                  { value: "all", label: tr("mobile.allMessages") },
                  { value: "off", label: tr("mobile.off") },
                ],
                (v) => setNotif({ dmNotifications: v as DmNotificationMode })
              )}
              {toggle(
                tr("mobile.search.popupNotifications"),
                notificationSettings.popupEnabled,
                (v) => {
                  setNotif({ popupEnabled: v });
                  if (v) void requestDesktopNotificationPermission();
                },
                tr("mobile.notifSystem"),
                false
              )}
            </Card>

            <M3Subheader>{tr("mobile.sound")}</M3Subheader>
            <Card>
              {toggle(
                tr("mobile.search.notificationSound"),
                notificationSettings.soundEnabled,
                (v) => setNotif({ soundEnabled: v }),
                undefined,
                notificationSettings.soundEnabled
              )}
              {notificationSettings.soundEnabled && (
                <>
                  {select(
                    tr("mobile.search.channelSound"),
                    notificationSettings.soundPreset === "custom"
                      ? "custom"
                      : notificationSettings.soundPreset || "chime",
                    notificationSettings.soundPreset === "custom"
                      ? [...soundOptions, { value: "custom", label: tr("mobile.sound.customFile") }]
                      : soundOptions,
                    (v) => setNotif({ soundPreset: v as SoundPreset })
                  )}
                  {select(
                    tr("mobile.search.dmSound"),
                    notificationSettings.dmSoundPreset || "chime",
                    notificationSettings.dmSoundPreset === "custom"
                      ? [...soundOptions, { value: "custom", label: tr("mobile.sound.customFile") }]
                      : soundOptions,
                    (v) => setNotif({ dmSoundPreset: v as SoundPreset })
                  )}
                  {select(
                    tr("mobile.search.soundCooldown"),
                    String(notificationSettings.soundCooldownMs ?? 3000),
                    cooldownOptions.some(
                      (o) => o.value === String(notificationSettings.soundCooldownMs ?? 3000)
                    )
                      ? cooldownOptions
                      : [
                          ...cooldownOptions,
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
                      {tr("rest.playSound")}
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
            <M3Subheader>{tr("mobile.search.theme")}</M3Subheader>
            <Card>
              {select(
                tr("settings.language.label"),
                language,
                [
                  { value: "system", label: tr("settings.language.system") },
                  { value: "en", label: tr("settings.language.en") },
                  { value: "pl", label: tr("settings.language.pl") },
                ],
                (v) => setLanguage(v as AppLanguage)
              )}
              {select(
                tr("mobile.search.theme"),
                themeMode,
                [
                  { value: "system", label: tr("mobile.systemDefault"), description: tr("mobile.followPhoneTheme") },
                  { value: "light", label: tr("mobile.light") },
                  { value: "dark", label: tr("mobile.dark") },
                ],
                (v) => setThemeMode(v as MobileThemeMode)
              )}
              {toggle(
                tr("mobile.search.pureBlack"),
                pureBlack,
                setPureBlack,
                tr("mobile.pureBlackDesc"),
                false
              )}
            </Card>

            <M3Subheader>{tr("mobile.display")}</M3Subheader>
            <Card>
              {select(
                tr("mobile.search.userDisplayName"),
                store.userDisplayNameMode || "nickname",
                [
                  { value: "nickname", label: tr("mobile.nickname") },
                  { value: "realname", label: tr("mobile.realName"), description: tr("mobile.fallsBackNick") },
                  { value: "username", label: tr("mobile.username"), description: tr("mobile.fallsBackNick") },
                ],
                (v) => store.setUserDisplayNameMode(v as UserDisplayNameMode)
              )}
              {toggle(
                tr("mobile.search.groupByRole"),
                store.groupMembersByRole ?? true,
                store.setGroupMembersByRole,
                tr("mobile.splitRoles")
              )}
            </Card>

            <M3Subheader>{tr("mobile.datesAndEmoji")}</M3Subheader>
            <Card>
              {select(
                tr("mobile.search.dateFormat"),
                store.dateFormatPreset || "d MMM yyyy, HH:mm",
                [
                  "d MMM yyyy, HH:mm",
                  "yyyy-MM-dd HH:mm",
                  "MM/dd/yyyy hh:mm a",
                  "dd.MM.yyyy HH:mm",
                ]
                  .map((f) => ({ value: f, label: formatMessageDate(new Date(), f, "") }))
                  .concat({ value: "custom", label: tr("mobile.customFormat") }),
                store.setDateFormatPreset,
                store.dateFormatPreset !== "custom"
              )}
              {store.dateFormatPreset === "custom" &&
                fieldBox(
                  <M3TextField
                    label={tr("mobile.customDateFormat")}
                    value={store.customDateFormat || ""}
                    onChange={store.setCustomDateFormat}
                    placeholder="yyyy/MM/dd HH:mm"
                    monospace
                    labelBackground={t.surfaceContainer}
                    supportingText={`${tr("settings.appearance.preview")} ${formatMessageDate(
                      new Date(),
                      "custom",
                      store.customDateFormat || "yyyy/MM/dd HH:mm"
                    )}`}
                  />
                )}
            </Card>

            <M3Subheader>{tr("mobile.lists")}</M3Subheader>
            <Card>
              {toggle(
                tr("mobile.search.sortDmUnread"),
                store.sortDmByUnread ?? true,
                store.setSortDmByUnread
              )}
              {select(
                tr("mobile.search.dmSortOrder"),
                store.dmSortOrder ?? "opening",
                [
                  { value: "opening", label: tr("mobile.byOpening") },
                  { value: "alphabetical", label: tr("mobile.alphabetical") },
                ],
                (v) => store.setDmSortOrder(v as "opening" | "alphabetical")
              )}
              {select(
                tr("mobile.search.statusIndicator"),
                store.statusDisplayMode || "always",
                [
                  { value: "always", label: tr("mobile.alwaysShow") },
                  { value: "on_error", label: tr("mobile.onlyOnError") },
                  { value: "disabled", label: tr("mobile.hidden") },
                ],
                (v) => store.setStatusDisplayMode(v as StatusDisplayMode),
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
          .concat({ value: "custom", label: tr("mobile.customFormat") });
        return (
          <>
            <M3Subheader>{tr("mobile.behavior")}</M3Subheader>
            <Card>
              {toggle(
                tr("mobile.search.markdown"),
                store.enableMarkdown ?? true,
                store.setEnableMarkdown,
                tr("mobile.markdownDesc")
              )}
              {toggle(
                tr("mobile.search.scrollOnReturn"),
                store.scrollToUnreadOnFocus ?? false,
                store.setScrollToUnreadOnFocus,
                tr("mobile.scrollDesc")
              )}
              {toggle(
                tr("mobile.search.formattingPreview"),
                store.enableFormattingPreview ?? true,
                store.setEnableFormattingPreview,
                tr("mobile.formattingDesc"),
                false
              )}
              {select(
                tr("mobile.search.emojiSize"),
                String(store.jumbojiSize ?? 42),
                [
                  { value: "0", label: tr("mobile.disabled") },
                  { value: "32", label: tr("mobile.small") },
                  { value: "42", label: tr("mobile.default") },
                  { value: "56", label: tr("mobile.large") },
                ],
                (v) => store.setJumbojiSize(Number(v)),
                false
              )}
              {toggle(
                tr("mobile.search.confirmLeave"),
                store.confirmLeaveChannel ?? true,
                store.setConfirmLeaveChannel
              )}
              {toggle(
                tr("mobile.search.slashSuggestions"),
                store.enableCommandSuggestions ?? true,
                store.setEnableCommandSuggestions
              )}
              {select(
                tr("mobile.search.defaultReplyFormat"),
                store.defaultReplyMode || "auto",
                [
                  {
                    value: "auto",
                    label: tr("mobile.auto"),
                    description: tr("mobile.autoDesc"),
                  },
                  { value: "modern", label: tr("mobile.modernOnly") },
                  { value: "legacy", label: tr("mobile.legacyOnly") },
                  { value: "hybrid", label: tr("mobile.hybrid"), description: tr("mobile.bothFormats") },
                ],
                (v) => store.setDefaultReplyMode(v as ReplyMode)
              )}
              {select(
                tr("mobile.search.nickCompletion"),
                store.nickCompletionFormat || "plain",
                nickOptions,
                (v) => store.setNickCompletionFormat(v as NickCompletionFormat),
                store.nickCompletionFormat !== "custom"
              )}
              {store.nickCompletionFormat === "custom" &&
                fieldBox(
                  <M3TextField
                    label={tr("mobile.customPattern")}
                    value={store.customNickCompletionFormat || ""}
                    onChange={store.setCustomNickCompletionFormat}
                    placeholder="{nick}: "
                    monospace
                    labelBackground={t.surfaceContainer}
                    supportingText={`${tr("settings.appearance.preview")} ${formatNickCompletion(
                      "Alice",
                      "custom",
                      store.customNickCompletionFormat || "{nick}: "
                    )}hello there!`}
                  />
                )}
              {select(
                tr("mobile.search.motd"),
                store.globalMotdPolicy || "on_change",
                [
                  { value: "on_change", label: tr("mobile.whenChanged") },
                  { value: "always", label: tr("mobile.always") },
                  { value: "never", label: tr("mobile.never") },
                ],
                (v) => store.setGlobalMotdPolicy(v as MotdDisplayPolicy),
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
              tr("mobile.cat.previews"),
              store.enableLinkPreviews,
              store.setEnableLinkPreviews,
              tr("mobile.linkPreviewsDesc")
            )}
            {toggle("Web page previews", store.enableWebPagePreviews, store.setEnableWebPagePreviews)}
            {toggle(
              tr("mobile.search.autoCollapse"),
              store.autoCollapseImages ?? false,
              store.setAutoCollapseImages
            )}
            {toggle(
              tr("mobile.search.motdMedia"),
              store.enableMotdMediaPreviews ?? false,
              store.setEnableMotdMediaPreviews
            )}
            {fieldBox(
              <M3TextField
                label={tr("mobile.search.previewApi")}
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
              tr("mobile.search.uploadProvider"),
              cfg.provider,
              [
                { value: "disabled", label: tr("mobile.disabled") },
                {
                  value: "litterbox",
                  label: tr("mobile.litterbox"),
                  description: tr("mobile.litterboxDesc"),
                },
                { value: "pomf", label: tr("mobile.pomf"), description: tr("mobile.pomfDesc") },
              ],
              (v) => store.setUploadConfig({ ...cfg, provider: v as ImageUploadProvider }),
              cfg.provider !== "disabled"
            )}
            {cfg.provider === "litterbox" &&
              select(
                tr("mobile.search.litterboxExpiration"),
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
                  label={tr("mobile.search.pomfUrl")}
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
              {tr("rest.headerRulesDesc")}
            </Box>
            <M3Subheader>{tr("mobile.rules")}</M3Subheader>
            <Card>
              {store.urlAuthRules.length === 0 ? (
                <M3ListItem headline={tr("mobile.noRules")} />
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
                        aria-label={tr("mobile.deleteRule")}
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
            <M3Subheader>{tr("mobile.newRule")}</M3Subheader>
            <Card>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, px: 2.5, pt: 2.5, pb: 2 }}>
                <M3TextField
                  label={tr("mobile.urlPrefix")}
                  value={newRulePrefix}
                  onChange={setNewRulePrefix}
                  placeholder="https://img.example.com/"
                  labelBackground={t.surfaceContainer}
                />
                <M3TextField
                  label={tr("mobile.headerName")}
                  value={newRuleHeaderName}
                  onChange={setNewRuleHeaderName}
                  monospace
                  labelBackground={t.surfaceContainer}
                />
                <M3TextField
                  label={tr("mobile.headerValue")}
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
                    {tr("rest.addRule")}
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

  const activeCategory = categories.find((c) => c.id === category);

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
            aria-label={tr("mobile.back")}
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
            placeholder={tr("mobile.search.placeholder")}
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
                {tr("rest.noMatchingSettings")}
              </Box>
            )
          ) : null
        ) : (
          <Card>
            {categories.map((c, i) => (
              <M3ListItem
                key={c.id}
                leading={c.icon}
                headline={c.title}
                supporting={c.subtitle}
                divider={i < categories.length - 1}
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
