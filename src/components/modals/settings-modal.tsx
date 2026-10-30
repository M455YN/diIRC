import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "react-i18next";
import { useLanguageStore, type AppLanguage } from "@/hooks/use-language-store";
import { getCurrentAppVersion } from "@/lib/changelog-service";
import { openExternalUrl } from "@/lib/system-utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal-store";
import { useIsMobileShell } from "@/hooks/use-mobile-platform";
import { useMockStore } from "@/lib/mock-store";
import { ImageUploadProvider, LitterboxTime } from "@/lib/upload/types";
import { cn } from "@/lib/utils";
import {
  Settings,
  ExternalLink,
  Eye,
  EyeOff,
  Info,
  Link2,
  Server,
  Globe,
  ShieldCheck,
  UploadCloud,
  AlertTriangle,
  Key,
  Plus,
  Trash2,
  Activity,
  Command,
  FileText,
  LogOut,
  Calendar,
  Bell,
  Volume2,
  Play,
  Monitor,
  DownloadCloud,
  RefreshCw,
  CheckCircle2,
  Loader2,
  Sparkles,
  MessageSquare,
  ArrowUpDown,
  ScrollText,
  AtSign,
  Smile,
  Reply,
  Users,
  Palette,
} from "lucide-react";
import { StatusDisplayMode, formatMessageDate, NickCompletionFormat, formatNickCompletion } from "@/lib/mock-store";
import { MotdDisplayPolicy, UserDisplayNameMode, ReplyMode } from "@/types";
import { playNotificationSound, SoundPreset } from "@/lib/notification-sound";
import { requestDesktopNotificationPermission } from "@/lib/notification-service";
import { NotificationSettingsFields } from "@/components/notifications/notification-settings-fields";
import {
  BUILD_UPDATE_CHANNEL,
  UPDATE_CHANNELS,
  checkForAppUpdate,
  resolveUpdateChannelId,
} from "@/lib/update-service";
import { Update } from "@tauri-apps/plugin-updater";
import tauriConfig from "../../../src-tauri/tauri.conf.json";
import { SettingsTransferSection } from "@/components/settings/transfer-section";
import { MobileSettingsModal } from "@/components/mobile/mobile-settings";
import { useTheme } from "next-themes";
import { useAppearanceStyleStore, useIsWindows11, type AppearanceStyle, type MessageLayout, type WindowMaterial } from "@/hooks/use-appearance-style";

const COLOR_MODES: { id: string; title: string; description: string }[] = [
  { id: "system", title: "settings.appearance.color.system", description: "settings.appearance.color.systemDesc" },
  { id: "light", title: "settings.appearance.color.light", description: "settings.appearance.color.lightDesc" },
  { id: "dark", title: "settings.appearance.color.dark", description: "settings.appearance.color.darkDesc" },
  { id: "oled", title: "settings.appearance.color.oled", description: "settings.appearance.color.oledDesc" },
];

const APPEARANCE_STYLES: { id: AppearanceStyle; title: string; description: string }[] = [
  { id: "standard", title: "settings.appearance.style.standard", description: "settings.appearance.style.standardDesc" },
  { id: "fluent", title: "settings.appearance.style.fluent", description: "settings.appearance.style.fluentDesc" },
];

type SettingsTab = "appearance" | "writing" | "reading" | "notifications" | "media" | "app";

// Same categories as the mobile settings screen, plus desktop-only "Updates".
const ABOUT_AUTHORS = [
  { name: "Jakub Baka", url: "https://github.com/TheStami" },
  { name: "Bartosz Sebastian Kasprzycki", url: "https://github.com/Bar-Kas" },
  { name: "Mateusz Afelt", url: "https://github.com/M455YN" },
];
const ABOUT_REPO_URL = "https://github.com/M455YN/diIRC";

const SETTINGS_TABS: { id: SettingsTab; title: string; icon: typeof Bell }[] = [
  { id: "appearance", title: "settings.tabs.appearance", icon: Palette },
  { id: "writing", title: "settings.tabs.writing", icon: MessageSquare },
  { id: "reading", title: "settings.tabs.reading", icon: Eye },
  { id: "notifications", title: "settings.tabs.notifications", icon: Bell },
  { id: "media", title: "settings.tabs.media", icon: Link2 },
  { id: "app", title: "settings.tabs.app", icon: Monitor },
];

const SETTINGS_SEARCH_INDEX: { key: string; tab: SettingsTab }[] = [
  { key: "settings.items.channelNotifications", tab: "notifications" },
  { key: "settings.items.dmNotifications", tab: "notifications" },
  { key: "settings.items.notificationSound", tab: "notifications" },
  { key: "settings.items.channelSound", tab: "notifications" },
  { key: "settings.items.dmSound", tab: "notifications" },
  { key: "settings.items.soundCooldown", tab: "notifications" },
  { key: "settings.items.popupNotifications", tab: "notifications" },
  { key: "settings.items.taskbarHighlight", tab: "notifications" },
  { key: "settings.items.colors", tab: "appearance" },
  { key: "settings.items.messageLayout", tab: "appearance" },
  { key: "settings.items.visualStyle", tab: "appearance" },
  { key: "settings.items.windowMaterial", tab: "appearance" },
  { key: "settings.items.displayNameFormat", tab: "appearance" },
  { key: "settings.items.groupByRole", tab: "appearance" },
  { key: "settings.items.dateFormat", tab: "appearance" },
  { key: "settings.items.sortDmByRecent", tab: "appearance" },
  { key: "settings.items.sortDmByUnread", tab: "appearance" },
  { key: "settings.items.sortDm", tab: "appearance" },
  { key: "settings.items.statusIndicator", tab: "appearance" },
  { key: "settings.items.confirmLeave", tab: "writing" },
  { key: "settings.items.linkPreview", tab: "media" },
  { key: "settings.items.blockedImagePreview", tab: "media" },
  { key: "settings.items.showEvents", tab: "reading" },
  { key: "settings.items.groupEvents", tab: "reading" },
  { key: "settings.items.highlightWords", tab: "reading" },
  { key: "settings.items.identity", tab: "writing" },
  { key: "settings.items.warnExternalLinks", tab: "media" },
  { key: "settings.items.ignoreList", tab: "reading" },
  { key: "settings.items.sendTyping", tab: "writing" },
  { key: "settings.items.slashAutocomplete", tab: "writing" },
  { key: "settings.items.markdown", tab: "writing" },
  { key: "settings.items.formattingPreview", tab: "writing" },
  { key: "settings.items.scrollOnReturn", tab: "reading" },
  { key: "settings.items.jumboji", tab: "appearance" },
  { key: "settings.items.replyFormat", tab: "writing" },
  { key: "settings.items.nickCompletion", tab: "writing" },
  { key: "settings.items.motd", tab: "reading" },
  { key: "settings.items.linkPreviews", tab: "media" },
  { key: "settings.items.collapseImages", tab: "media" },
  { key: "settings.items.motdMedia", tab: "media" },
  { key: "settings.items.webMetadata", tab: "media" },
  { key: "settings.items.previewApi", tab: "media" },
  { key: "settings.items.uploadProvider", tab: "media" },
  { key: "settings.items.pomf", tab: "media" },
  { key: "settings.items.imageAuth", tab: "media" },
  { key: "settings.items.softwareUpdates", tab: "app" },
  { key: "settings.items.updateChannel", tab: "app" },
  { key: "settings.items.checkUpdates", tab: "app" },
];

/** A settings card: icon, title and description on the left, an on/off switch on the right. */
const SettingSwitch = ({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <div className="flex flex-row items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 shadow-sm transition">
    <div className="space-y-0.5 pr-4">
      <div className="flex items-center gap-x-2">
        {icon}
        <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer">{title}</label>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{description}</p>
    </div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

/** A titled group of settings cards inside a tab. */
const SettingsSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="space-y-3">
    <h3 className="border-b border-zinc-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-700/60 dark:text-zinc-400">
      {title}
    </h3>
    {children}
  </section>
);

export const SettingsModal = () => {
  const { isOpen, onClose, type, onOpen } = useModal();
  const isMobile = useIsMobileShell();
  const [tab, setTab] = useState<SettingsTab>("appearance");
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const [query, setQuery] = useState("");
  const trimmedQuery = query.trim().toLowerCase();
  const searching = trimmedQuery.length > 0;
  const searchResults = searching
    ? SETTINGS_SEARCH_INDEX.filter((item) => t(item.key).toLowerCase().includes(trimmedQuery))
    : [];
  const { theme: colorMode, setTheme: setColorMode } = useTheme();
  const appearanceStyle = useAppearanceStyleStore((state) => state.style);
  const setAppearanceStyle = useAppearanceStyleStore((state) => state.setStyle);
  const isWindows11 = useIsWindows11();
  const windowMaterial = useAppearanceStyleStore((state) => state.material);
  const messageLayout = useAppearanceStyleStore((state) => state.layout);
  const setMessageLayout = useAppearanceStyleStore((state) => state.setLayout);
  const setWindowMaterial = useAppearanceStyleStore((state) => state.setMaterial);
  const groupMembersByRole = useMockStore((state) => state.groupMembersByRole ?? true);
  const setGroupMembersByRole = useMockStore((state) => state.setGroupMembersByRole);

  const confirmLeaveChannel = useMockStore((state) => state.confirmLeaveChannel ?? true);
  const setConfirmLeaveChannel = useMockStore((state) => state.setConfirmLeaveChannel);
  const openLinksInPreview = useMockStore((state) => state.openLinksInPreview ?? false);
  const setOpenLinksInPreview = useMockStore((state) => state.setOpenLinksInPreview);
  const openBlockedImagesInPreview = useMockStore((state) => state.openBlockedImagesInPreview ?? true);
  const setOpenBlockedImagesInPreview = useMockStore((state) => state.setOpenBlockedImagesInPreview);
  const sendTypingNotifications = useMockStore((state) => state.sendTypingNotifications);
  const setSendTypingNotifications = useMockStore((state) => state.setSendTypingNotifications);
  const showEvents = useMockStore((state) => state.showEvents);
  const setShowEvent = useMockStore((state) => state.setShowEvent);
  const groupEvents = useMockStore((state) => state.groupEvents);
  const highlightWords = useMockStore((state) => state.highlightWords);
  const setHighlightWords = useMockStore((state) => state.setHighlightWords);
  const enableHighlights = useMockStore((state) => state.enableHighlights);
  const setEnableHighlights = useMockStore((state) => state.setEnableHighlights);
  const [highlightDraft, setHighlightDraft] = useState<string | null>(null);
  const profileName = useMockStore((state) => state.currentProfile.name);
  const setProfileName = useMockStore((state) => state.setProfileName);
  const warnExternalLinks = useMockStore((state) => state.warnExternalLinks);
  const setWarnExternalLinks = useMockStore((state) => state.setWarnExternalLinks);
  const trustedLinkHosts = useMockStore((state) => state.trustedLinkHosts);
  const clearTrustedLinkHosts = useMockStore((state) => state.clearTrustedLinkHosts);
  const quitMessage = useMockStore((state) => state.quitMessage);
  const setQuitMessage = useMockStore((state) => state.setQuitMessage);
  const defaultAwayReason = useMockStore((state) => state.defaultAwayReason);
  const setDefaultAwayReason = useMockStore((state) => state.setDefaultAwayReason);
  const ignoredUsers = useMockStore((state) => state.ignoredUsers);
  const setIgnoredUsers = useMockStore((state) => state.setIgnoredUsers);
  const [ignoreDraft, setIgnoreDraft] = useState<string | null>(null);
  const setGroupEvents = useMockStore((state) => state.setGroupEvents);

  const enableCommandSuggestions = useMockStore((state) => state.enableCommandSuggestions ?? true);
  const interactiveCommands = useMockStore((state) => state.interactiveCommands ?? true);
  const setInteractiveCommands = useMockStore((state) => state.setInteractiveCommands);
  const setEnableCommandSuggestions = useMockStore((state) => state.setEnableCommandSuggestions);

  const enableLinkPreviews = useMockStore((state) => state.enableLinkPreviews);
  const setEnableLinkPreviews = useMockStore((state) => state.setEnableLinkPreviews);

  const autoCollapseImages = useMockStore((state) => state.autoCollapseImages ?? false);
  const setAutoCollapseImages = useMockStore((state) => state.setAutoCollapseImages);

  const enableMotdMediaPreviews = useMockStore((state) => state.enableMotdMediaPreviews ?? false);
  const setEnableMotdMediaPreviews = useMockStore((state) => state.setEnableMotdMediaPreviews);

  const enableWebPagePreviews = useMockStore((state) => state.enableWebPagePreviews);
  const setEnableWebPagePreviews = useMockStore((state) => state.setEnableWebPagePreviews);
  const blockLinkPreviewAds = useMockStore((state) => state.blockLinkPreviewAds);
  const setBlockLinkPreviewAds = useMockStore((state) => state.setBlockLinkPreviewAds);

  const enableMarkdown = useMockStore((state) => state.enableMarkdown ?? true);
  const setEnableMarkdown = useMockStore((state) => state.setEnableMarkdown);

  const enableFormattingPreview = useMockStore((state) => state.enableFormattingPreview ?? true);
  const setEnableFormattingPreview = useMockStore((state) => state.setEnableFormattingPreview);
  const scrollToUnreadOnFocus = useMockStore((state) => state.scrollToUnreadOnFocus ?? false);
  const setScrollToUnreadOnFocus = useMockStore((state) => state.setScrollToUnreadOnFocus);

  const linkPreviewApiUrl = useMockStore((state) => state.linkPreviewApiUrl);
  const setLinkPreviewApiUrl = useMockStore((state) => state.setLinkPreviewApiUrl);

  const uploadConfig = useMockStore((state) => state.uploadConfig);
  const setUploadConfig = useMockStore((state) => state.setUploadConfig);

  const urlAuthRules = useMockStore((state) => state.urlAuthRules);
  const addUrlAuthRule = useMockStore((state) => state.addUrlAuthRule);
  const removeUrlAuthRule = useMockStore((state) => state.removeUrlAuthRule);

  const statusDisplayMode = useMockStore((state) => state.statusDisplayMode) || "always";
  const setStatusDisplayMode = useMockStore((state) => state.setStatusDisplayMode);

  const dateFormatPreset = useMockStore((state) => state.dateFormatPreset) || "d MMM yyyy, HH:mm";
  const setDateFormatPreset = useMockStore((state) => state.setDateFormatPreset);

  const customDateFormat = useMockStore((state) => state.customDateFormat) || "yyyy/MM/dd HH:mm";
  const setCustomDateFormat = useMockStore((state) => state.setCustomDateFormat);

  const nickCompletionFormat = useMockStore((state) => state.nickCompletionFormat) || "plain";
  const setNickCompletionFormat = useMockStore((state) => state.setNickCompletionFormat);

  const customNickCompletionFormat = useMockStore((state) => state.customNickCompletionFormat) || "{nick}: ";
  const setCustomNickCompletionFormat = useMockStore((state) => state.setCustomNickCompletionFormat);

  const defaultReplyMode = useMockStore((state) => state.defaultReplyMode) || "hybrid";
  const setDefaultReplyMode = useMockStore((state) => state.setDefaultReplyMode);

  const notificationSettings = useMockStore((state) => state.notificationSettings) || {
    soundEnabled: true,
    soundPreset: "chime",
    popupEnabled: true,
    taskbarHighlightEnabled: true,
  };
  const setGlobalNotificationSettings = useMockStore((state) => state.setGlobalNotificationSettings);

  const autoUpdateMode = useMockStore((state) => state.autoUpdateMode) || "ask";
  const setAutoUpdateMode = useMockStore((state) => state.setAutoUpdateMode);

  const updateSourceMode = useMockStore((state) => state.updateSourceMode) || "default";
  const setUpdateSourceMode = useMockStore((state) => state.setUpdateSourceMode);
  const customUpdateUrl = useMockStore((state) => state.customUpdateUrl) || "";
  const setCustomUpdateUrl = useMockStore((state) => state.setCustomUpdateUrl);
  const customUpdatePubkey = useMockStore((state) => state.customUpdatePubkey) || "";
  const setCustomUpdatePubkey = useMockStore((state) => state.setCustomUpdatePubkey);
  const activeUpdateChannel = resolveUpdateChannelId(updateSourceMode);

  const sortDmByRecent = useMockStore((state) => state.sortDmByRecent ?? true);
  const setSortDmByRecent = useMockStore((state) => state.setSortDmByRecent);
  const sortDmByUnread = useMockStore((state) => state.sortDmByUnread ?? true);
  const setSortDmByUnread = useMockStore((state) => state.setSortDmByUnread);

  const dmSortOrder = useMockStore((state) => state.dmSortOrder ?? "opening");
  const setDmSortOrder = useMockStore((state) => state.setDmSortOrder);

  const globalMotdPolicy = useMockStore((state) => state.globalMotdPolicy) || "on_change";
  const setGlobalMotdPolicy = useMockStore((state) => state.setGlobalMotdPolicy);

  const userDisplayNameMode = useMockStore((state) => state.userDisplayNameMode) || "nickname";
  const setUserDisplayNameMode = useMockStore((state) => state.setUserDisplayNameMode);

  const jumbojiSize = useMockStore((state) => state.jumbojiSize ?? 42);
  const setJumbojiSize = useMockStore((state) => state.setJumbojiSize);

  const [checkStatus, setCheckStatus] = useState<"idle" | "checking" | "upToDate" | "available" | "error">("idle");
  const [foundUpdate, setFoundUpdate] = useState<Update | null>(null);
  const [checkErrorMsg, setCheckErrorMsg] = useState<string | null>(null);

  const handleManualCheckUpdates = async () => {
    setCheckStatus("checking");
    setCheckErrorMsg(null);
    try {
      const update = await checkForAppUpdate();
      if (update && update.available) {
        setFoundUpdate(update);
        setCheckStatus("available");
      } else {
        setFoundUpdate(null);
        setCheckStatus("upToDate");
      }
    } catch (err: any) {
      setFoundUpdate(null);
      setCheckStatus("error");
      setCheckErrorMsg(err?.message || String(err));
    }
  };

  const handleOpenUpdateModal = () => {
    if (!foundUpdate) return;
    const currentVersion = tauriConfig.version || "0.1.7";
    onOpen("updateAvailable", {
      updateInfo: {
        currentVersion,
        version: foundUpdate.version,
        body: foundUpdate.body,
        date: foundUpdate.date,
      },
      updateRef: foundUpdate,
    } as any);
  };

  // New URL Rule Form State
  const [newRulePrefix, setNewRulePrefix] = useState("");
  const [newRuleHeaderName, setNewRuleHeaderName] = useState("Authorization");
  const [newRuleHeaderValue, setNewRuleHeaderValue] = useState("");

  const isModalOpen = isOpen && type === "settings";

  const handleClose = () => {
    setQuery("");
    onClose();
  };

  const handleTestSound = () => {
    playNotificationSound(notificationSettings.soundPreset || "chime");
  };

  const handleTogglePopup = async (checked: boolean) => {
    setGlobalNotificationSettings({ popupEnabled: checked });
    if (checked) {
      await requestDesktopNotificationPermission();
    }
  };

  const handleProviderChange = (provider: ImageUploadProvider) => {
    setUploadConfig({
      ...uploadConfig,
      provider,
    });
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRulePrefix || !newRuleHeaderName || !newRuleHeaderValue) return;
    addUrlAuthRule({
      urlPrefix: newRulePrefix,
      headerName: newRuleHeaderName,
      headerValue: newRuleHeaderValue,
    });
    setNewRulePrefix("");
    setNewRuleHeaderValue("");
  };

  // Material 3 categorized settings on mobile (Android Settings-style)
  if (isMobile) {
    return <MobileSettingsModal />;
  }

  return (
    <Dialog open={isModalOpen} onOpenChange={handleClose}>
      <DialogContent className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl dark:border-zinc-800 dark:bg-[#313338] dark:text-zinc-100 sm:max-w-4xl">
        <DialogHeader className="space-y-1 px-6 pb-4 pt-6 text-left">
          <DialogTitle className="flex items-center gap-x-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            <Settings className="h-6 w-6 text-indigo-500" />
            {t("settings.title")}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
            {t("settings.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("settings.searchPlaceholder")}
            aria-label={t("settings.searchPlaceholder")}
            className="h-9 bg-white text-sm dark:bg-[#1e1f22]"
          />
        </div>

        <div className="flex h-[70vh] flex-col border-t border-zinc-200 dark:border-zinc-800 sm:flex-row">
          <nav
            aria-label={t("settings.ariaCategories")}
            className="flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-[#2b2d31] sm:w-56 sm:flex-col sm:overflow-y-auto sm:overflow-x-visible sm:border-b-0 sm:border-r sm:p-3"
          >
            {SETTINGS_TABS.map(({ id, title, icon: TabIcon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={tab === id ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-x-2.5 rounded-md px-3 py-2 text-left text-sm font-medium transition cursor-pointer",
                  tab === id
                    ? "bg-indigo-500/10 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-300"
                    : "text-zinc-600 hover:bg-zinc-200/70 dark:text-zinc-300 dark:hover:bg-zinc-700/50"
                )}
              >
                <TabIcon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{t(title)}</span>
              </button>
            ))}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
          {searching && (
            <div className="space-y-2">
              {searchResults.length === 0 ? (
                <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  {t("settings.searchNoResults", { query: query.trim() })}
                </p>
              ) : (
                searchResults.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setTab(item.tab);
                      setQuery("");
                    }}
                    className="flex w-full items-center justify-between gap-x-3 rounded-md border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm transition hover:border-indigo-400 dark:border-zinc-700 dark:bg-[#2b2d31] dark:hover:border-indigo-500"
                  >
                    <span className="font-medium text-zinc-800 dark:text-zinc-100">{t(item.key)}</span>
                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                      {t(SETTINGS_TABS.find((entry) => entry.id === item.tab)?.title ?? "")}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
          {!searching && tab === "appearance" && (
            <div className="space-y-8">
              <SettingsSection title={t("settings.sections.theme")}>
                <div className="space-y-5">
                {/* SECTION: COLOUR MODE */}
                <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm transition">
                  <div className="flex items-center gap-x-2">
                    <Palette className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("settings.appearance.colors")}</label>
                  </div>
                  <div role="radiogroup" aria-label={t("settings.appearance.colors")} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {COLOR_MODES.map(({ id, title, description }) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={colorMode === id}
                        onClick={() => setColorMode(id)}
                        className={cn(
                          "flex flex-col items-start rounded-lg border p-3 text-left text-xs transition cursor-pointer",
                          colorMode === id
                            ? "border-indigo-500 bg-indigo-500/10 text-indigo-900 dark:text-indigo-100"
                            : "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/40"
                        )}
                      >
                        <span className="font-semibold">{t(title)}</span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{t(description)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* SECTION: VISUAL STYLE (Windows 11+ only) */}
                {isWindows11 && (
                  <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm transition">
                    <div className="flex items-center gap-x-2">
                      <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                      <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("settings.items.visualStyle")}</label>
                    </div>
                    <div role="radiogroup" aria-label={t("settings.items.visualStyle")} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {APPEARANCE_STYLES.map(({ id, title, description }) => (
                        <button
                          key={id}
                          type="button"
                          role="radio"
                          aria-checked={appearanceStyle === id}
                          onClick={() => setAppearanceStyle(id)}
                          className={cn(
                            "flex flex-col items-start rounded-lg border p-3 text-left text-xs transition cursor-pointer",
                            appearanceStyle === id
                              ? "border-indigo-500 bg-indigo-500/10 text-indigo-900 dark:text-indigo-100"
                              : "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/40"
                          )}
                        >
                          <span className="font-semibold">{t(title)}</span>
                          <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{t(description)}</span>
                        </button>
                      ))}
                    </div>
                    {appearanceStyle === "fluent" && (
                      <div className="space-y-1.5 pt-1">
                        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          {t("settings.appearance.windowMaterial")}
                        </label>
                        <select
                          value={windowMaterial}
                          onChange={(e) => setWindowMaterial(e.target.value as WindowMaterial)}
                          className="w-full bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="mica">{t("settings.appearance.mica")}</option>
                          <option value="acrylic">{t("settings.appearance.acrylic")}</option>
                          <option value="none">{t("settings.appearance.noneOpaque")}</option>
                        </select>
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {t("settings.appearance.windowMaterialDesc")}
                        </p>
                      </div>
                    )}
                  </div>
                )}
                </div>
              </SettingsSection>
              <SettingsSection title={t("settings.sections.messages")}>
                <div className="space-y-5">
                {/* SECTION: MESSAGE LAYOUT */}
                <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm transition">
                  <div className="flex items-center gap-x-2">
                    <MessageSquare className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("settings.appearance.messageLayout")}</label>
                  </div>
                  <div role="radiogroup" aria-label={t("settings.appearance.messageLayout")} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {([
                      // Persisted id stays "discord" so an already saved layout is not reset.
                      { id: "discord", title: "settings.appearance.layout.modern", description: "settings.appearance.layout.modernDesc" },
                      { id: "irc", title: "settings.appearance.layout.irc", description: "settings.appearance.layout.ircDesc" },
                    ] as { id: MessageLayout; title: string; description: string }[]).map(({ id, title, description }) => (
                      <button
                        key={id}
                        type="button"
                        role="radio"
                        aria-checked={messageLayout === id}
                        onClick={() => setMessageLayout(id)}
                        className={cn(
                          "flex flex-col items-start rounded-lg border p-3 text-left text-xs transition cursor-pointer",
                          messageLayout === id
                            ? "border-indigo-500 bg-indigo-500/10 text-indigo-900 dark:text-indigo-100"
                            : "border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/40"
                        )}
                      >
                        <span className="font-semibold">{t(title)}</span>
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">{t(description)}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Jumboji Enlarged Emoji Size */}
                <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-x-2">
                      <Smile className="w-4 h-4 text-amber-500" />
                      <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {t("settings.chat.jumboji")}
                      </label>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 font-mono">
                      {jumbojiSize === 0 ? "Disabled (Normal size)" : `${jumbojiSize}px`}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {t("settings.chat.jumbojiDesc")}
                  </p>
                  <div className="flex items-center gap-x-4 pt-1">
                    <input
                      type="range"
                      min="0"
                      max="64"
                      step="2"
                      value={jumbojiSize}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (val > 0 && val < 14) {
                          setJumbojiSize(14);
                        } else {
                          setJumbojiSize(val);
                        }
                      }}
                      className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>
                {/* SECTION: USER DISPLAY NAME FORMAT */}
                <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm transition">
                  <div className="flex items-center gap-x-2">
                    <Sparkles className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("settings.appearance.displayName")}
                    </label>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {t("settings.appearance.displayNameDesc")}
                  </p>
                  <select
                    value={userDisplayNameMode}
                    onChange={(e) => setUserDisplayNameMode(e.target.value as UserDisplayNameMode)}
                    className="w-full bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="nickname">{t("settings.appearance.nickname")}</option>
                    <option value="realname">{t("settings.appearance.realname")}</option>
                    <option value="username">{t("settings.appearance.username")}</option>
                  </select>
                </div>
                {/* Date Display Format */}
                <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm transition">
                  <div className="flex items-center gap-x-2">
                    <Calendar className="w-4 h-4 text-indigo-500" />
                    <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("settings.appearance.dateFormat")}
                    </label>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {t("settings.appearance.dateFormatDesc")}
                  </p>
                  <select
                    value={dateFormatPreset}
                    onChange={(e) => setDateFormatPreset(e.target.value)}
                    className="w-full bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="d MMM yyyy, HH:mm">{t("settings.appearance.dateDefault")}</option>
                    <option value="yyyy-MM-dd HH:mm:ss">{t("settings.appearance.dateIso")}</option>
                    <option value="MM/dd/yyyy, h:mm a">{t("settings.appearance.dateUs")}</option>
                    <option value="dd.MM.yyyy HH:mm">{t("settings.appearance.dateEu")}</option>
                    <option value="HH:mm:ss">{t("settings.appearance.dateTimeOnly")}</option>
                    <option value="custom">{t("settings.appearance.dateCustom")}</option>
                  </select>

                  {dateFormatPreset === "custom" && (
                    <div className="space-y-1 pt-1">
                      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {t("settings.appearance.customPattern")}
                      </label>
                      <Input
                        value={customDateFormat}
                        onChange={(e) => setCustomDateFormat(e.target.value)}
                        placeholder="e.g. yyyy/MM/dd HH:mm"
                        className="bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100"
                      />
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {t("settings.appearance.tokensBasedOn")} <a href="https://unicode.org/reports/tr35/tr35-dates.html#Date_Format_Patterns" target="_blank" rel="noreferrer" className="text-indigo-500 hover:underline">{t("settings.appearance.unicodeStandard")}</a> {t("settings.appearance.tokensExample")}
                      </p>
                    </div>
                  )}

                  <div className="pt-1 text-xs text-zinc-500 dark:text-zinc-400 font-mono flex items-center justify-between border-t border-zinc-200 dark:border-zinc-700/50 mt-1">
                    <span className="font-sans text-[11px]">{t("settings.appearance.preview")}</span>
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                      {formatMessageDate(new Date(), dateFormatPreset, customDateFormat)}
                    </span>
                  </div>
                </div>
                </div>
              </SettingsSection>
              <SettingsSection title={t("settings.sections.lists")}>
                <div className="space-y-5">
                {/* Group users by role */}
                <SettingSwitch
                  icon={<Users className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />}
                  title={t("settings.appearance.groupByRole")}
                  description={t("settings.appearance.groupByRoleDesc")}
                  checked={groupMembersByRole}
                  onChange={setGroupMembersByRole}
                />
                {/* Newest Private Messages First */}
                <SettingSwitch
                  icon={<MessageSquare className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                  title={t("settings.appearance.sortDmRecent")}
                  description={t("settings.appearance.sortDmRecentDesc")}
                  checked={sortDmByRecent}
                  onChange={setSortDmByRecent}
                />
                {/* Sort Private Messages by Unread */}
                <SettingSwitch
                  icon={<MessageSquare className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                  title={t("settings.appearance.sortDmUnread")}
                  description={t("settings.appearance.sortDmUnreadDesc")}
                  checked={sortDmByUnread}
                  onChange={setSortDmByUnread}
                />
                {/* Base Private Message Sorting */}
                <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm transition">
                  <div className="flex items-center gap-x-2">
                    <ArrowUpDown className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("settings.appearance.sortDm")}
                    </label>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {t("settings.appearance.sortDmDesc")}
                  </p>
                  <select
                    value={dmSortOrder}
                    onChange={(e) => setDmSortOrder(e.target.value as "opening" | "alphabetical")}
                    className="w-full bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="opening">{t("settings.appearance.byOpening")}</option>
                    <option value="alphabetical">{t("settings.appearance.alphabetical")}</option>
                  </select>
                </div>
                {/* Status Indicator Display Mode */}
                <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm transition">
                  <div className="flex items-center gap-x-2">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("settings.appearance.statusIndicator")}
                    </label>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {t("settings.appearance.statusIndicatorDesc")}
                  </p>
                  <select
                    value={statusDisplayMode}
                    onChange={(e) => setStatusDisplayMode(e.target.value as StatusDisplayMode)}
                    className="w-full bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="always">{t("settings.appearance.alwaysShow")}</option>
                    <option value="on_error">{t("settings.appearance.onError")}</option>
                    <option value="disabled">{t("settings.appearance.disabledHidden")}</option>
                  </select>
                </div>
                </div>
              </SettingsSection>
            </div>
          )}

          {!searching && tab === "writing" && (
            <div className="space-y-8">
              <SettingsSection title={t("settings.sections.composer")}>
                <div className="space-y-5">
                {/* Markdown Rendering */}
                <div className="flex flex-row items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 shadow-sm transition">
                  <div className="space-y-0.5 pr-4">
                    <div className="flex items-center gap-x-2">
                      <FileText className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                      <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                        {t("settings.chat.markdown")}
                      </label>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {t("settings.chat.markdownRender")} <span className="font-mono">**bold**</span> <span className="font-mono">*italic*</span> <span className="font-mono">__underline__</span> <span className="font-mono">~~strike~~</span> <span className="font-mono">`code`</span> <span className="font-mono">```block```</span> <span className="font-mono">&gt;quote</span> <span className="font-mono">||spoiler||</span> {t("settings.chat.markdownLinks")}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed pt-1">
                      {t("settings.chat.composerShortcuts")} <span className="font-mono">Ctrl+B</span> {t("settings.chat.sc.bold")}, <span className="font-mono">Ctrl+I</span> {t("settings.chat.sc.italic")}, <span className="font-mono">Ctrl+U</span> {t("settings.chat.sc.underline")}, <span className="font-mono">Ctrl+Shift+X</span> {t("settings.chat.sc.strike")}, <span className="font-mono">Ctrl+Shift+E</span> {t("settings.chat.sc.inlineCode")}, <span className="font-mono">Ctrl+Shift+H</span> {t("settings.chat.sc.spoiler")}, <span className="font-mono">Ctrl+Z</span> {t("settings.chat.sc.undo")}, <span className="font-mono">Ctrl+Y</span> / <span className="font-mono">Ctrl+Shift+Z</span> {t("settings.chat.sc.redo")}.
                    </p>
                  </div>
                  <Switch
                    checked={enableMarkdown}
                    onCheckedChange={(checked) => setEnableMarkdown(checked)}
                  />
                </div>
                {/* Formatting Preview */}
                <div className="flex flex-row items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 shadow-sm transition">
                  <div className="space-y-0.5 pr-4">
                    <div className="flex items-center gap-x-2">
                      <Eye className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                      <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 cursor-pointer">
                        {t("settings.chat.formattingPreview")}
                      </label>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {t("settings.chat.formattingPreviewDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={enableFormattingPreview}
                    onCheckedChange={(checked) => setEnableFormattingPreview(checked)}
                    disabled={!enableMarkdown}
                  />
                </div>
                {/* Slash Command Autocomplete */}
                <SettingSwitch
                  icon={<Command className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                  title={t("settings.chat.slashAutocomplete")}
                  description={t("settings.chat.slashAutocompleteDesc")}
                  checked={enableCommandSuggestions}
                  onChange={setEnableCommandSuggestions}
                />
                {/* Interactive command panels (/mode, /op, /deop, /voice, /devoice) */}
                <SettingSwitch
                  icon={<Command className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                  title={t("settings.chat.interactiveCommands")}
                  description={t("settings.chat.interactiveCommandsDesc")}
                  checked={interactiveCommands}
                  onChange={setInteractiveCommands}
                />
                {/* Default Reply Format */}
                <div className="flex flex-col gap-y-2 rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 shadow-sm transition">
                  <div className="flex items-center gap-x-2">
                    <Reply className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("settings.chat.replyFormat")}
                    </label>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {t("settings.chat.replyFormatDesc")}
                  </p>
                  <select
                    value={defaultReplyMode}
                    onChange={(e) => setDefaultReplyMode(e.target.value as ReplyMode)}
                    className="w-full bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="auto">{t("settings.chat.replyAuto")}</option>
                    <option value="modern">{t("settings.chat.replyModern")}</option>
                    <option value="legacy">{t("settings.chat.replyLegacy")}</option>
                    <option value="hybrid">{t("settings.chat.replyHybrid")}</option>
                  </select>
                </div>
                {/* Nickname Completion / Addressing Format */}
                <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm transition">
                  <div className="flex items-center gap-x-2">
                    <AtSign className="w-4 h-4 text-indigo-500" />
                    <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("settings.chat.nickCompletion")}
                    </label>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {t("settings.chat.nickCompletionDesc")}
                  </p>
                  <select
                    value={nickCompletionFormat}
                    onChange={(e) => setNickCompletionFormat(e.target.value as NickCompletionFormat)}
                    className="w-full bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="plain">{t("settings.chat.nickPlain")}</option>
                    <option value="colon">{t("settings.chat.nickColon")}</option>
                    <option value="comma">{t("settings.chat.nickComma")}</option>
                    <option value="at">{t("settings.chat.nickAt")}</option>
                    <option value="arrow">{t("settings.chat.nickArrow")}</option>
                    <option value="hyphen">{t("settings.chat.nickHyphen")}</option>
                    <option value="bracket">{t("settings.chat.nickBrackets")}</option>
                    <option value="custom">{t("settings.appearance.customPattern")}</option>
                  </select>

                  {nickCompletionFormat === "custom" && (
                    <div className="space-y-1 pt-1">
                      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        {t("settings.appearance.customPattern")}
                      </label>
                      <Input
                        value={customNickCompletionFormat}
                        onChange={(e) => setCustomNickCompletionFormat(e.target.value)}
                        placeholder="e.g. {nick}: or >> {nick} "
                        className="bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-xs text-zinc-900 dark:text-zinc-100"
                      />
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Use <code className="bg-zinc-200 dark:bg-zinc-700 px-1 py-0.5 rounded text-[10px] font-mono">{"{nick}"}</code> as placeholder for the member's nickname (e.g. <code className="font-mono">{"{nick}: "}</code> or <code className="font-mono">{"[{nick}] "}</code>).
                      </p>
                    </div>
                  )}

                  <div className="pt-1 text-xs text-zinc-500 dark:text-zinc-400 font-mono flex items-center justify-between border-t border-zinc-200 dark:border-zinc-700/50 mt-1">
                    <span className="font-sans text-[11px]">{t("settings.appearance.preview")}</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {formatNickCompletion("Alice", nickCompletionFormat, customNickCompletionFormat)}
                      <span className="text-zinc-500 dark:text-zinc-400 font-normal">{t("settings.chat.hello")}</span>
                    </span>
                  </div>
                </div>
                </div>
              </SettingsSection>
              <SettingsSection title={t("settings.sections.you")}>
                <div className="space-y-5">
                <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm">
                  <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("settings.chat.identity")}
                  </label>
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">{t("settings.chat.defaultNick")}</label>
                  <Input
                    value={profileName}
                    onChange={(e) => setProfileName(e.target.value.replace(/\s+/g, ""))}
                    className="h-9 bg-white text-sm dark:bg-[#1e1f22]"
                  />
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">{t("settings.chat.quitMessage")}</label>
                  <Input
                    value={quitMessage}
                    onChange={(e) => setQuitMessage(e.target.value)}
                    placeholder="Client disconnected"
                    className="h-9 bg-white text-sm dark:bg-[#1e1f22]"
                  />
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">{t("settings.chat.awayReason")}</label>
                  <Input
                    value={defaultAwayReason}
                    onChange={(e) => setDefaultAwayReason(e.target.value)}
                    placeholder="Away"
                    className="h-9 bg-white text-sm dark:bg-[#1e1f22]"
                  />
                </div>
                <SettingSwitch
                  icon={<MessageSquare className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                  title={t("settings.chat.sendTyping")}
                  description={t("settings.chat.sendTypingDesc")}
                  checked={sendTypingNotifications}
                  onChange={setSendTypingNotifications}
                />
                {/* Confirm Before Leaving Channel */}
                <SettingSwitch
                  icon={<LogOut className="w-4 h-4 text-rose-500 dark:text-rose-400" />}
                  title={t("settings.chat.confirmLeave")}
                  description={t("settings.chat.confirmLeaveDesc")}
                  checked={confirmLeaveChannel}
                  onChange={setConfirmLeaveChannel}
                />
                </div>
              </SettingsSection>
            </div>
          )}

          {!searching && tab === "reading" && (
            <div className="space-y-8">
              <SettingsSection title={t("settings.sections.events")}>
                <div className="space-y-5">
                <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm">
                  <div className="flex items-center gap-x-2">
                    <Users className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("settings.chat.eventsTitle")}
                    </label>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {t("settings.chat.showEventDesc")}
                  </p>
                  <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                    {(["join", "part", "quit", "nick", "kick"] as const).map((kind) => (
                      <div key={kind} className="flex items-center justify-between gap-x-3 text-sm text-zinc-800 dark:text-zinc-200">
                        <span>{t(`settings.chat.showEvent.${kind}`)}</span>
                        <Switch checked={showEvents[kind]} onCheckedChange={(show) => setShowEvent(kind, show)} />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1 border-t border-zinc-200 pt-3 dark:border-zinc-700/60">
                    <div className="flex items-center justify-between gap-x-3 text-sm text-zinc-800 dark:text-zinc-200">
                      <span>{t("settings.chat.groupEvents")}</span>
                      <Switch checked={groupEvents} onCheckedChange={setGroupEvents} />
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {t("settings.chat.groupEventsDesc")}
                    </p>
                  </div>
                </div>
                </div>
              </SettingsSection>
              <SettingsSection title={t("settings.sections.highlighting")}>
                <div className="space-y-5">
                <SettingSwitch
                  icon={<AtSign className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                  title={t("settings.chat.enableHighlights")}
                  description={t("settings.chat.enableHighlightsDesc")}
                  checked={enableHighlights}
                  onChange={setEnableHighlights}
                />
                {enableHighlights && (
                  <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm">
                    <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("settings.chat.highlightWords")}
                    </label>
                    <Textarea
                      rows={3}
                      className="font-mono text-xs"
                      placeholder={t("settings.chat.highlightWordsPlaceholder")}
                      value={highlightDraft ?? highlightWords.join("\n")}
                      onChange={(e) => setHighlightDraft(e.target.value)}
                      onBlur={() => {
                        if (highlightDraft !== null) setHighlightWords(highlightDraft.split(/\r?\n/));
                        setHighlightDraft(null);
                      }}
                    />
                  </div>
                )}
                <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm">
                  <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t("settings.chat.ignoreList")}
                  </label>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {t("settings.chat.ignoreListDesc")}
                  </p>
                  <Textarea
                    rows={4}
                    className="font-mono text-xs"
                    placeholder={t("settings.chat.ignoreListPlaceholder")}
                    value={ignoreDraft ?? ignoredUsers.join("\n")}
                    onChange={(e) => setIgnoreDraft(e.target.value)}
                    onBlur={() => {
                      if (ignoreDraft !== null) setIgnoredUsers(ignoreDraft.split(/\r?\n/));
                      setIgnoreDraft(null);
                    }}
                  />
                </div>
                </div>
              </SettingsSection>
              <SettingsSection title={t("settings.sections.scrolling")}>
                <div className="space-y-5">
                {/* Scroll to unread when returning to the app */}
                <div className="flex flex-row items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 shadow-sm transition">
                  <div className="space-y-0.5 pr-4">
                    <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {t("settings.chat.scrollOnReturn")}
                    </label>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {t("settings.chat.scrollOnReturnDesc")}
                    </p>
                  </div>
                  <Switch
                    checked={scrollToUnreadOnFocus}
                    onCheckedChange={(checked) => setScrollToUnreadOnFocus(checked)}
                  />
                </div>
                </div>
              </SettingsSection>
              <SettingsSection title={t("settings.sections.motd")}>
                <div className="space-y-5">
                {/* Message of the day (MOTD) */}
                <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-x-2">
                      <ScrollText className="w-4 h-4 text-indigo-500" />
                      <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {t("settings.chat.motd")}
                      </label>
                    </div>
                    <Switch
                      checked={globalMotdPolicy !== "never"}
                      onCheckedChange={(checked) => {
                        setGlobalMotdPolicy(checked ? "on_change" : "never");
                      }}
                    />
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {t("settings.chat.motdDesc")}
                  </p>
                  {globalMotdPolicy !== "never" && (
                    <select
                      value={globalMotdPolicy}
                      onChange={(e) => setGlobalMotdPolicy(e.target.value as MotdDisplayPolicy)}
                      className="w-full bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="on_change">{t("settings.chat.motdWhenChanged")}</option>
                      <option value="always">{t("settings.chat.motdAlways")}</option>
                      <option value="never">{t("settings.chat.motdNever")}</option>
                    </select>
                  )}
                </div>
                </div>
              </SettingsSection>
            </div>
          )}

          {!searching && tab === "notifications" && (
            <div className="space-y-8">
              <div className="space-y-5">
                {/* SECTION: GLOBAL NOTIFICATIONS */}
                <NotificationSettingsFields
                  mode="global"
                  values={{
                    channelNotifications: notificationSettings.channelNotifications || "mentions",
                    dmNotifications: notificationSettings.dmNotifications || "all",
                    sound: notificationSettings.soundEnabled,
                    soundPreset: notificationSettings.soundPreset || "chime",
                    dmSoundPreset: notificationSettings.dmSoundPreset || "chime",
                    customSoundUrl: notificationSettings.customSoundUrl,
                    customDmSoundUrl: notificationSettings.customDmSoundUrl,
                    soundCooldown: notificationSettings.soundCooldownMs ?? 3000,
                    popup: notificationSettings.popupEnabled,
                    taskbar: notificationSettings.taskbarHighlightEnabled,
                  }}
                  onChange={(field, val) => {
                    if (field === "channelNotifications") setGlobalNotificationSettings({ channelNotifications: val });
                    else if (field === "dmNotifications") setGlobalNotificationSettings({ dmNotifications: val });
                    else if (field === "sound") setGlobalNotificationSettings({ soundEnabled: Boolean(val) });
                    else if (field === "soundPreset") setGlobalNotificationSettings({ soundPreset: val });
                    else if (field === "dmSoundPreset") setGlobalNotificationSettings({ dmSoundPreset: val });
                    else if (field === "customSoundUrl") setGlobalNotificationSettings({ customSoundUrl: val });
                    else if (field === "customDmSoundUrl") setGlobalNotificationSettings({ customDmSoundUrl: val });
                    else if (field === "soundCooldown") setGlobalNotificationSettings({ soundCooldownMs: Number(val) });
                    else if (field === "popup") setGlobalNotificationSettings({ popupEnabled: Boolean(val) });
                    else if (field === "taskbar") setGlobalNotificationSettings({ taskbarHighlightEnabled: Boolean(val) });
                  }}
                />
              </div>
            </div>
          )}

          {!searching && tab === "media" && (
            <div className="space-y-8">
              <SettingsSection title={t("settings.sections.links")}>
                <div className="space-y-5">
                {/* Open links in a preview window */}
                <SettingSwitch
                  icon={<ExternalLink className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                  title={t("settings.chat.linkPreview")}
                  description={t("settings.chat.linkPreviewDesc")}
                  checked={openLinksInPreview}
                  onChange={setOpenLinksInPreview}
                />
                {/* Open blocked images in a preview window */}
                <SettingSwitch
                  icon={<ExternalLink className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                  title={t("settings.chat.blockedImagePreview")}
                  description={t("settings.chat.blockedImagePreviewDesc")}
                  checked={openBlockedImagesInPreview}
                  onChange={setOpenBlockedImagesInPreview}
                />
                <SettingSwitch
                  icon={<ExternalLink className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                  title={t("settings.chat.warnExternalLinks")}
                  description={t("settings.chat.warnExternalLinksDesc")}
                  checked={warnExternalLinks}
                  onChange={setWarnExternalLinks}
                />
                {trustedLinkHosts.length > 0 && (
                  <div className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 text-xs text-zinc-600 dark:text-zinc-300">
                    <span className="truncate pr-3">{t("settings.chat.trustedSites", { sites: trustedLinkHosts.join(", ") })}</span>
                    <button type="button" onClick={clearTrustedLinkHosts} className="shrink-0 text-indigo-500 hover:underline">
                      {t("settings.chat.clearTrustedSites")}
                    </button>
                  </div>
                )}
                </div>
              </SettingsSection>
              <SettingsSection title={t("settings.sections.previews")}>
                <div className="space-y-5">
                {/* Switch 1: Enable Link Previews (All embeds) */}
                <SettingSwitch
                  icon={<Link2 className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                  title={t("settings.previews.linkPreviews")}
                  description={t("settings.previews.linkPreviewsDesc")}
                  checked={enableLinkPreviews}
                  onChange={setEnableLinkPreviews}
                />
                {/* Switch 1b: Collapse Images by Default */}
                <SettingSwitch
                  icon={<EyeOff className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                  title={t("settings.previews.collapseImages")}
                  description={t("settings.previews.collapseImagesDesc")}
                  checked={autoCollapseImages}
                  onChange={setAutoCollapseImages}
                />
                {/* Switch 1c: Render media embeds in MOTD */}
                <SettingSwitch
                  icon={<ScrollText className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                  title={t("settings.previews.motdMedia")}
                  description={t("settings.previews.motdMediaDesc")}
                  checked={enableMotdMediaPreviews}
                  onChange={setEnableMotdMediaPreviews}
                />
                {/* Switch 2: Web Page Metadata API Previews */}
                {enableLinkPreviews && (
                  <SettingSwitch
                    icon={<Globe className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                    title={t("settings.previews.webMetadata")}
                    description={t("settings.previews.webMetadataDesc")}
                    checked={enableWebPagePreviews}
                    onChange={setEnableWebPagePreviews}
                  />
                )}
                {enableLinkPreviews && (
                  <SettingSwitch
                    icon={<ShieldCheck className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                    title={t("settings.previews.blockAds")}
                    description={t("settings.previews.blockAdsDesc")}
                    checked={blockLinkPreviewAds}
                    onChange={setBlockLinkPreviewAds}
                  />
                )}
                </div>
              </SettingsSection>
              <SettingsSection title={t("settings.sections.uploads")}>
                <div className="space-y-5">
                {/* SECTION: IMAGE UPLOADER SERVER */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-4 shadow-sm transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-x-2">
                      <UploadCloud className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                      <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {t("settings.uploads.provider")}
                      </label>
                    </div>
                    {uploadConfig.provider === "litterbox" && (
                      <span className="text-xs px-2 py-0.5 font-bold rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                        {t("settings.uploads.temporary")}
                      </span>
                    )}
                    {uploadConfig.provider === "pomf" && (
                      <span className="text-xs px-2 py-0.5 font-bold rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                        {t("settings.uploads.pomf")}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {t("settings.uploads.providerDesc")}
                  </p>

                  {/* Provider Selection Dropdown */}
                  <select
                    value={uploadConfig.provider}
                    onChange={(e) => handleProviderChange(e.target.value as ImageUploadProvider)}
                    className="w-full bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="disabled">{t("settings.uploads.disabled")}</option>
                    <option value="litterbox" className="text-amber-600 font-bold">
                      ⚠️ Litterbox (public, expiration 1h - 72h)
                    </option>
                    <option value="pomf" className="text-indigo-600 font-bold">
                      🐱 POMF / Pomf.cat (public)
                    </option>
                  </select>

                  {/* Litterbox Warning & Retention Config */}
                  {uploadConfig.provider === "litterbox" && (
                    <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 space-y-2 text-xs text-amber-600 dark:text-amber-400">
                      <div className="flex items-center gap-x-1.5 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                        {t("settings.uploads.litterboxInfo")}
                      </div>
                      <p className="text-[11px] leading-relaxed opacity-90">
                        {t("settings.uploads.litterboxDesc")}
                      </p>

                      <div className="pt-1 flex items-center justify-between">
                        <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                          {t("settings.uploads.retention")}
                        </label>
                        <select
                          value={uploadConfig.litterboxTime || "24h"}
                          onChange={(e) =>
                            setUploadConfig({ ...uploadConfig, litterboxTime: e.target.value as LitterboxTime })
                          }
                          className="bg-white dark:bg-[#1e1f22] border border-amber-500/40 rounded px-2 py-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100"
                        >
                          <option value="1h">{t("settings.uploads.h1")}</option>
                          <option value="12h">{t("settings.uploads.h12")}</option>
                          <option value="24h">{t("settings.uploads.h24")}</option>
                          <option value="72h">{t("settings.uploads.h72")}</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* POMF Configuration */}
                  {uploadConfig.provider === "pomf" && (
                    <div className="space-y-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                          {t("settings.uploads.pomfUrl")}
                        </label>
                        <Input
                          value={uploadConfig.pomfUrl || ""}
                          onChange={(e) => setUploadConfig({ ...uploadConfig, pomfUrl: e.target.value })}
                          placeholder="https://pomf.cat/upload.php"
                          className="bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-xs"
                        />
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          Leave default address <code className="text-indigo-400">https://pomf.cat/upload.php</code> or enter your custom POMF instance address.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </SettingsSection>
              <SettingsSection title={t("settings.sections.advanced")}>
                <div className="space-y-5">
                {/* Custom Link Preview API Endpoint Input */}
                {enableLinkPreviews && enableWebPagePreviews && (
                  <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-2 shadow-sm transition">
                    <div className="flex items-center gap-x-2">
                      <Server className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                      <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {t("settings.previews.apiUrl")}
                      </label>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {t("settings.previews.apiUrlDesc")}
                    </p>
                    <Input
                      value={linkPreviewApiUrl}
                      onChange={(e) => setLinkPreviewApiUrl(e.target.value)}
                      placeholder="https://api.microlink.io"
                      className="bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs mt-2 focus-visible:ring-indigo-500"
                    />
                  </div>
                )}
                {/* SECTION: READING AUTHORIZATION (URL RULES) */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm transition">
                  <div className="flex items-center gap-x-2">
                    <Key className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                    <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                      {t("settings.auth.title")}
                    </label>
                  </div>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {t("settings.auth.desc")}
                  </p>

                  {/* List of rules */}
                  {urlAuthRules.length > 0 ? (
                    <div className="space-y-2">
                      {urlAuthRules.map((rule) => (
                        <div
                          key={rule.id}
                          className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-[#1e1f22] border border-zinc-200 dark:border-zinc-700/80 text-xs"
                        >
                          <div className="space-y-0.5 overflow-hidden pr-2">
                            <div className="font-bold text-indigo-500 truncate">{rule.urlPrefix}</div>
                            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                              {rule.headerName}: {rule.headerValue.slice(0, 15)}...
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeUrlAuthRule(rule.id)}
                            className="h-7 w-7 text-rose-500 hover:bg-rose-500/10 shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">{t("settings.auth.none")}</p>
                  )}

                  {/* Form to add new rule */}
                  <form onSubmit={handleAddRule} className="pt-2 space-y-2 border-t border-zinc-200 dark:border-zinc-700/60">
                    <div className="space-y-1">
                      <Input
                        value={newRulePrefix}
                        onChange={(e) => setNewRulePrefix(e.target.value)}
                        placeholder={t("settings.auth.urlPrefix")}
                        className="bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={newRuleHeaderName}
                        onChange={(e) => setNewRuleHeaderName(e.target.value)}
                        placeholder={t("settings.auth.headerName")}
                        className="bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-xs font-mono"
                      />
                      <Input
                        value={newRuleHeaderValue}
                        onChange={(e) => setNewRuleHeaderValue(e.target.value)}
                        placeholder={t("settings.auth.headerValue")}
                        className="bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-xs font-mono"
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="secondary"
                      size="sm"
                      className="w-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add authorization rule
                    </Button>
                  </form>
                </div>
                </div>
              </SettingsSection>
            </div>
          )}

          {!searching && tab === "app" && (
            <div className="space-y-8">
              <SettingsSection title={t("settings.sections.language")}>
                <div className="space-y-5">
                <div className="flex flex-col rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm transition">
                  <div className="flex items-center gap-x-2">
                    <Globe className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("settings.language.label")}</label>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{t("settings.language.description")}</p>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as AppLanguage)}
                    className="w-full bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="system">{t("settings.language.system")}</option>
                    <option value="en">{t("settings.language.en")}</option>
                    <option value="pl">{t("settings.language.pl")}</option>
                  </select>
                </div>
                </div>
              </SettingsSection>
              <SettingsSection title={t("settings.sections.updates")}>
                <div className="space-y-5">
                {/* SECTION: AUTOMATIC UPDATES */}
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-4 shadow-sm transition">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-x-2">
                      <DownloadCloud className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                      <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {t("settings.updates.title")}
                      </label>
                    </div>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300">
                      v{tauriConfig.version || "0.1.7"}
                    </span>
                  </div>

                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    {t("settings.updates.desc")}
                  </p>

                  {/* Mode selector */}
                  <div className="grid grid-cols-1 gap-2">
                    <label
                      className={`flex items-start gap-x-3 p-3 rounded-lg border cursor-pointer transition text-xs ${autoUpdateMode === "auto"
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-900 dark:text-indigo-100 font-semibold"
                        : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1e1f22] text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600"
                        }`}
                    >
                      <input
                        type="radio"
                        name="autoUpdateMode"
                        value="auto"
                        checked={autoUpdateMode === "auto"}
                        onChange={() => setAutoUpdateMode("auto")}
                        className="mt-0.5 accent-indigo-500 cursor-pointer"
                      />
                      <div>
                        <div className="font-bold flex items-center gap-x-1.5">
                          🚀 Automatic update on startup
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal mt-0.5">
                          {t("settings.updates.checkOnStart")}
                        </div>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-x-3 p-3 rounded-lg border cursor-pointer transition text-xs ${autoUpdateMode === "ask"
                        ? "border-indigo-500 bg-indigo-500/10 text-indigo-900 dark:text-indigo-100 font-semibold"
                        : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1e1f22] text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600"
                        }`}
                    >
                      <input
                        type="radio"
                        name="autoUpdateMode"
                        value="ask"
                        checked={autoUpdateMode === "ask"}
                        onChange={() => setAutoUpdateMode("ask")}
                        className="mt-0.5 accent-indigo-500 cursor-pointer"
                      />
                      <div>
                        <div className="font-bold flex items-center gap-x-1.5">
                          ❓ Ask about update on startup (Popup prompt)
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal mt-0.5">
                          {t("settings.updates.askDialog")}
                        </div>
                      </div>
                    </label>

                    <label
                      className={`flex items-start gap-x-3 p-3 rounded-lg border cursor-pointer transition text-xs ${autoUpdateMode === "disabled"
                        ? "border-rose-500/50 bg-rose-500/10 text-rose-900 dark:text-rose-100 font-semibold"
                        : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#1e1f22] text-zinc-700 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-zinc-600"
                        }`}
                    >
                      <input
                        type="radio"
                        name="autoUpdateMode"
                        value="disabled"
                        checked={autoUpdateMode === "disabled"}
                        onChange={() => setAutoUpdateMode("disabled")}
                        className="mt-0.5 accent-rose-500 cursor-pointer"
                      />
                      <div>
                        <div className="font-bold flex items-center gap-x-1.5 text-zinc-800 dark:text-zinc-200">
                          ⛔ Disable automatic updates
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-normal mt-0.5">
                          {t("settings.updates.manual")}
                        </div>
                      </div>
                    </label>
                  </div>

                  {/* Version source selector */}
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700/60 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-x-1.5">
                          <Server className="w-3.5 h-3.5 text-indigo-500" />
                          {t("settings.updates.channel")}
                        </div>
                        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {t("settings.updates.channelDesc")}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 pt-1">
                      <select
                        value={activeUpdateChannel}
                        onChange={(e) =>
                          setUpdateSourceMode(e.target.value as "official" | "skipahead" | "custom")
                        }
                        className="w-full bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        {Object.values(UPDATE_CHANNELS).map((channel) => (
                          <option key={channel.id} value={channel.id}>
                            {channel.label}
                            {channel.id === BUILD_UPDATE_CHANNEL ? " (this build)" : ""}
                          </option>
                        ))}
                        <option value="custom">{t("settings.updates.customUrl")}</option>
                      </select>

                      {activeUpdateChannel !== "custom" && (
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 pl-1">
                          {UPDATE_CHANNELS[activeUpdateChannel].description}
                        </div>
                      )}

                      {activeUpdateChannel === "custom" && (
                        <div className="space-y-1 mt-1">
                          <Input
                            value={customUpdateUrl}
                            onChange={(e) => setCustomUpdateUrl(e.target.value)}
                            placeholder="https://your-custom-worker.workers.dev/latest.json"
                            className="bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-xs font-mono"
                          />
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 pl-1">
                            {t("settings.updates.customEndpoint")}
                          </div>
                          <Input
                            value={customUpdatePubkey}
                            onChange={(e) => setCustomUpdatePubkey(e.target.value)}
                            placeholder={t("settings.updates.publicKeyPlaceholder")}
                            className="bg-white dark:bg-[#1e1f22] border-zinc-300 dark:border-zinc-700 text-xs font-mono"
                          />
                          <div className="text-[10px] text-zinc-500 dark:text-zinc-400 pl-1">
                            {t("settings.updates.publicKey")}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Check / Update action row */}
                  <div className="pt-2 border-t border-zinc-200 dark:border-zinc-700/60 flex items-center justify-between gap-x-3">
                    <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      {checkStatus === "idle" && (
                        <span className="text-zinc-500">Installed version: v{tauriConfig.version || "0.1.7"}</span>
                      )}
                      {checkStatus === "checking" && (
                        <span className="flex items-center gap-x-1.5 text-indigo-500 font-semibold">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {t("settings.updates.checking")}
                        </span>
                      )}
                      {checkStatus === "upToDate" && (
                        <span className="flex items-center gap-x-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          Luna IRC is up to date (v{tauriConfig.version || "0.1.7"})
                        </span>
                      )}
                      {checkStatus === "available" && (
                        <span className="flex items-center gap-x-1.5 text-indigo-600 dark:text-indigo-400 font-bold">
                          <Sparkles className="w-4 h-4 text-indigo-500" />
                          New version v{foundUpdate?.version} is available!
                        </span>
                      )}
                      {checkStatus === "error" && (
                        <span className="text-rose-500 text-[11px] block truncate max-w-[240px]">
                          Error: {checkErrorMsg || "Failed to connect to update server."}
                        </span>
                      )}
                    </div>

                    <div className="shrink-0">
                      {checkStatus === "available" ? (
                        <Button
                          size="sm"
                          onClick={handleOpenUpdateModal}
                          className="text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-x-1.5 shadow-sm"
                        >
                          <DownloadCloud className="w-3.5 h-3.5" />
                          Update now (v{foundUpdate?.version})
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={checkStatus === "checking"}
                          onClick={handleManualCheckUpdates}
                          className="text-xs font-semibold border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-x-1.5"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${checkStatus === "checking" ? "animate-spin" : ""}`} />
                          {t("settings.updates.checkNow")}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                </div>
              </SettingsSection>
              <SettingsSection title={t("settings.sections.transfer")}>
                <SettingsTransferSection />
              </SettingsSection>
              <SettingsSection title={t("settings.sections.about")}>
                <div className="space-y-5">
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 shadow-sm space-y-3">
                  <div>
                    <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Luna IRC</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("settings.about.version", { version: getCurrentAppVersion() })}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{t("settings.about.authors")}</p>
                    <ul className="mt-1 list-disc pl-5 text-sm text-zinc-700 dark:text-zinc-300">
                      {ABOUT_AUTHORS.map((author) => (
                        <li key={author.url}>
                          <button
                            type="button"
                            onClick={() => openExternalUrl(author.url)}
                            className="hover:underline"
                          >
                            {author.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openExternalUrl(ABOUT_REPO_URL)}
                  className="text-xs font-medium text-indigo-500 hover:underline dark:text-indigo-400"
                >
                  {t("settings.about.repo")}
                </button>
                </div>
              </SettingsSection>
            </div>
          )}

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
