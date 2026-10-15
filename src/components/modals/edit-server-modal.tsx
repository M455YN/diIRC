import * as z from "zod";
import { useTranslation } from "react-i18next";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useFieldArray } from "react-hook-form";
import { useEffect, useState , useMemo } from "react";
import { useNavigate } from "react-router-dom";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash, Bell, Volume2, Monitor, Clock, ScrollText, Sparkles, EyeOff, Reply, Server, Zap, MessageSquare, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";
import { useIsMobileShell } from "@/hooks/use-mobile-platform";
import { MobileServerFormModal } from "@/components/mobile/mobile-server-form";
import {
  NotificationOverrideValue,
  SoundPreset,
  ChannelNotificationOverrideValue,
  DmNotificationOverrideValue,
  ServerMotdDisplayPolicy,
  ServerUserDisplayNameMode,
  ServerMediaCollapseMode,
} from "@/types";
import { NotificationSettingsFields } from "@/components/notifications/notification-settings-fields";
import { CustomCommandsFields, normalizeCustomCommandsFromForm } from "@/components/server/custom-commands-fields";
import { toFormSteps } from "@/lib/commands/custom-command-steps";
import { ServerLogoField } from "@/components/server/server-logo-field";

const buildFormSchema = (t: (key: string) => string) => z.object({
  imageUrl: z.string().optional(),
  name: z.string().min(1, { message: t("server.validation.nameRequired") }),
  host: z.string().min(1, { message: t("server.validation.addressRequired") }),
  port: z.coerce.number().min(1).max(65535),
  nicknames: z.array(
    z.object({
      value: z.string()
        .min(1, { message: t("server.validation.nickRequired") })
        .refine((val) => !/\s/.test(val), { message: t("server.validation.nickSpaces") }),
    })
  ).min(1),
  username: z.string().optional(),
  realname: z.string().optional(),
  password: z.string().optional(),
  useTls: z.boolean().default(false),
  autoConnect: z.boolean().default(true),
  autoReconnect: z.boolean().default(true),
  parseLegacyZncTimestamps: z.boolean().default(false),
  replyMode: z.enum(["inherit", "auto", "modern", "legacy", "hybrid"]).default("inherit"),
  customCommands: z.array(
    z.object({
      trigger: z.string(),
      description: z.string().optional().default(""),
      suggestions: z.string().optional().default(""),
      steps: z
        .array(
          z.object({
            type: z.enum(["message", "mention", "openUrl"]),
            text: z.string().default(""),
            target: z.string().default(""),
            url: z.string().default(""),
          })
        )
        .default([]),
    })
  ).default([]),
});

type ServerFormValues = z.infer<ReturnType<typeof buildFormSchema>>;

type ServerTab = "connection" | "behavior" | "chat" | "notifications" | "commands";

const SERVER_TABS: { id: ServerTab; title: string; icon: typeof Bell }[] = [
  { id: "connection", title: "server.tabs.connection", icon: Server },
  { id: "behavior", title: "server.tabs.behavior", icon: Zap },
  { id: "chat", title: "server.tabs.chat", icon: MessageSquare },
  { id: "notifications", title: "server.tabs.notifications", icon: Bell },
  { id: "commands", title: "server.tabs.commands", icon: Command },
];

// Which tab hosts each form field, so a validation error can bring the user to it.
const FIELD_TAB: Record<string, ServerTab> = {
  name: "connection", host: "connection", port: "connection", password: "connection",
  username: "connection", realname: "connection", nicknames: "connection", useTls: "connection",
  autoConnect: "behavior", autoReconnect: "behavior", parseLegacyZncTimestamps: "behavior",
  replyMode: "chat",
  customCommands: "commands",
};

export const EditServerModal = () =>
  useIsMobileShell() ? <MobileServerFormModal mode="edit" /> : <DesktopServerFormModal mode="edit" />;

/** One desktop form for both "Add IRC server" and "Edit server settings". */
export const DesktopServerFormModal = ({ mode }: { mode: "create" | "edit" }) => {
  const { t } = useTranslation();
  const isCreate = mode === "create";
  const { isOpen, onClose, type, data } = useModal();
  const navigate = useNavigate();
  const addServer = useMockStore((state) => state.addServer);
  const updateServer = useMockStore((state) => state.updateServer);
  const currentProfile = useMockStore((state) => state.currentProfile);

  const isModalOpen = isOpen && type === (isCreate ? "createServer" : "editServer");
  const { server: initialServer } = data;

  const existingServer = useMockStore((state) =>
    state.servers.find((s) => s.id === initialServer?.id)
  ) || initialServer;
  const server = isCreate ? undefined : existingServer;

  const globalNotif = useMockStore((state) => state.notificationSettings);
  const globalMotdPolicy = useMockStore((state) => state.globalMotdPolicy) || "on_change";
  const autoCollapseImages = useMockStore((state) => state.autoCollapseImages ?? false);
  const serverMotdPolicies = useMockStore((state) => state.serverMotdPolicies);
  const setServerMotdPolicy = useMockStore((state) => state.setServerMotdPolicy);
  const setServerMediaCollapsePolicy = useMockStore((state) => state.setServerMediaCollapsePolicy);
  const setGlobalMotdPolicy = useMockStore((state) => state.setGlobalMotdPolicy);

  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [tab, setTab] = useState<ServerTab>("connection");
  const [motdPolicyOverride, setMotdPolicyOverride] = useState<ServerMotdDisplayPolicy>("default");
  const [displayNameModeOverride, setDisplayNameModeOverride] = useState<ServerUserDisplayNameMode>("default");
  const [mediaCollapseOverride, setMediaCollapseOverride] = useState<ServerMediaCollapseMode>("default");
  const [channelNotificationsOverride, setChannelNotificationsOverride] = useState<ChannelNotificationOverrideValue>("default");
  const [dmNotificationsOverride, setDmNotificationsOverride] = useState<DmNotificationOverrideValue>("default");
  const [soundOverride, setSoundOverride] = useState<NotificationOverrideValue>("default");
  const [popupOverride, setPopupOverride] = useState<NotificationOverrideValue>("default");
  const [taskbarOverride, setTaskbarOverride] = useState<NotificationOverrideValue>("default");
  const [soundCooldownOverride, setSoundCooldownOverride] = useState<"default" | number>("default");
  const [soundPresetOverride, setSoundPresetOverride] = useState<"default" | SoundPreset>("default");
  const [dmSoundPresetOverride, setDmSoundPresetOverride] = useState<"default" | SoundPreset>("default");
  const [customSoundUrlOverride, setCustomSoundUrlOverride] = useState<string | undefined>(undefined);
  const [customDmSoundUrlOverride, setCustomDmSoundUrlOverride] = useState<string | undefined>(undefined);

  const defaultReplyMode = useMockStore((state) => state.defaultReplyMode) || "auto";

  const inheritedChannelNotifStr =
    globalNotif?.channelNotifications === "all"
      ? t("server.opt.allMessages")
      : globalNotif?.channelNotifications === "off"
      ? t("server.opt.disabled")
      : t("server.opt.mentionsOnly");
  const inheritedDmNotifStr = globalNotif?.dmNotifications === "off" ? t("server.opt.disabled") : t("server.opt.enabled");
  const inheritedSoundStr = globalNotif?.soundEnabled ? t("server.opt.enabled") : t("server.opt.muted");
  const inheritedPopupStr = globalNotif?.popupEnabled ? t("server.opt.enabled") : t("server.opt.off");
  const inheritedTaskbarStr = globalNotif?.taskbarHighlightEnabled ? t("server.opt.enabled") : t("server.opt.off");
  const inheritedCooldownSec = ((globalNotif?.soundCooldownMs ?? 3000) / 1000).toFixed(1);
  const inheritedSoundPresetStr = globalNotif?.soundPreset || "chime";
  const inheritedDmSoundPresetStr = globalNotif?.dmSoundPreset || "chime";
  const inheritedReplyModeStr =
    defaultReplyMode === "modern"
      ? t("server.opt.modernOnly")
      : defaultReplyMode === "legacy"
      ? t("server.opt.legacyOnly")
      : defaultReplyMode === "hybrid"
      ? t("server.opt.hybrid")
      : t("server.opt.autoRecommended");

  const formSchema = useMemo(() => buildFormSchema(t), [t]);
  const form = useForm<ServerFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      imageUrl: "",
      name: "",
      host: "127.0.0.1",
      port: 6667,
      nicknames: [{ value: "ReactUser" }],
      realname: "",
      password: "",
      useTls: false,
      autoConnect: true,
      autoReconnect: true,
      parseLegacyZncTimestamps: false,
      replyMode: "inherit",
      customCommands: [],
    }
  });

  const { fields: nickFields, append: appendNick, remove: removeNick } = useFieldArray({
    name: "nicknames",
    control: form.control,
  });

  // Start on the first tab each time the modal opens (not on every store update).
  useEffect(() => {
    if (isModalOpen) setTab("connection");
  }, [isModalOpen]);

  // For a new server every field starts from its default (`server` is undefined).
  useEffect(() => {
    if (isModalOpen && (isCreate || server)) {
      const defaultNicks = server?.nicknames && server.nicknames.length > 0
        ? server.nicknames.map(n => ({ value: n }))
        : [{ value: currentProfile.name.replace(/\s+/g, "") || "ReactUser" }];

      setChannelNotificationsOverride(server?.notificationSettings?.channelNotifications || "default");
      setDmNotificationsOverride(server?.notificationSettings?.dmNotifications || "default");
      setSoundOverride(server?.notificationSettings?.sound || "default");
      setPopupOverride(server?.notificationSettings?.popup || "default");
      setTaskbarOverride(server?.notificationSettings?.taskbar || "default");
      setSoundCooldownOverride(server?.notificationSettings?.soundCooldown ?? "default");
      setSoundPresetOverride(server?.notificationSettings?.soundPreset || "default");
      setDmSoundPresetOverride(server?.notificationSettings?.dmSoundPreset || "default");
      setCustomSoundUrlOverride(server?.notificationSettings?.customSoundUrl);
      setCustomDmSoundUrlOverride(server?.notificationSettings?.customDmSoundUrl);
      setMotdPolicyOverride(
        server?.id && serverMotdPolicies[server.id]
          ? serverMotdPolicies[server.id]
          : server?.motdPolicy || "default"
      );
      setDisplayNameModeOverride(server?.displayNameMode || "default");
      setMediaCollapseOverride(server?.autoCollapseImages || "default");

      form.reset({
        imageUrl: server?.imageUrl || "",
        name: server?.name || "",
        host: server?.host || "127.0.0.1",
        port: server?.port || 6667,
        nicknames: defaultNicks,
        username: server?.username || "",
        realname: server?.realname || "",
        password: server?.password || "",
        useTls: server?.useTls ?? false,
        autoConnect: server?.autoConnect ?? true,
        autoReconnect: server?.autoReconnect ?? true,
        parseLegacyZncTimestamps: server?.parseLegacyZncTimestamps ?? false,
        replyMode: server?.replyMode ?? "inherit",
        customCommands: (server?.customCommands || []).map((c) => ({
          trigger: c.trigger,
          description: c.description || "",
          suggestions: (c.suggestions || []).join(", "),
          steps: toFormSteps(c),
        })),
      });
    }
  }, [server, isCreate, isModalOpen, form, currentProfile]);

  const isLoading = form.formState.isSubmitting;

  const saveServer = async (values: ServerFormValues) => {
    if (!isCreate && !server?.id) return;
    try {
      const nickArray = values.nicknames
        .map(n => n.value.trim())
        .filter(Boolean);

      // addServer only seeds the connection basics; the shared updateServer below applies the rest.
      const serverId = isCreate
        ? addServer({
            name: values.name,
            host: values.host,
            port: values.port,
            nicknames: nickArray,
            useTls: values.useTls,
            autoConnect: values.autoConnect,
            autoReconnect: values.autoReconnect,
          }).id
        : server!.id;

      updateServer(serverId, {
        imageUrl: values.imageUrl,
        name: values.name,
        host: values.host,
        port: values.port,
        nicknames: nickArray,
        username: values.username || "",
        realname: values.realname || "",
        password: values.password || "",
        useTls: values.useTls,
        autoConnect: values.autoConnect,
        autoReconnect: values.autoReconnect,
        parseLegacyZncTimestamps: values.parseLegacyZncTimestamps,
        replyMode: values.replyMode,
        customCommands: normalizeCustomCommandsFromForm(values.customCommands),
        motdPolicy: motdPolicyOverride,
        displayNameMode: displayNameModeOverride,
        autoCollapseImages: mediaCollapseOverride,
        notificationSettings: {
          channelNotifications: channelNotificationsOverride,
          dmNotifications: dmNotificationsOverride,
          sound: soundOverride,
          popup: popupOverride,
          taskbar: taskbarOverride,
          soundCooldown: soundCooldownOverride,
          soundPreset: soundPresetOverride,
          dmSoundPreset: dmSoundPresetOverride,
          customSoundUrl: customSoundUrlOverride,
          customDmSoundUrl: customDmSoundUrlOverride,
        },
      });

      setServerMotdPolicy(serverId, motdPolicyOverride);
      setServerMediaCollapsePolicy(serverId, mediaCollapseOverride);
      setConfirmCloseOpen(false);
      form.reset();
      onClose();
      if (isCreate) navigate(`/servers/${serverId}`);
    } catch (error) {
      console.log(error);
    }
  };

  const onFormSubmit = async (values: ServerFormValues) => {
    await saveServer(values);
  };

  const onFormInvalid = (errors: Record<string, unknown>) => {
    const firstField = Object.keys(errors)[0];
    if (firstField && FIELD_TAB[firstField]) {
      setTab(FIELD_TAB[firstField]);
    }
    setConfirmCloseOpen(false);
  };

  const handleAttemptClose = () => {
    if (!isCreate && form.formState.isDirty) {
      setConfirmCloseOpen(true);
    } else {
      handleForceClose();
    }
  };

  const handleForceClose = () => {
    setConfirmCloseOpen(false);
    form.reset();
    onClose();
  };

  return (
    <>
      <Dialog open={isModalOpen} onOpenChange={handleAttemptClose}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden sm:max-w-4xl h-[80vh] max-h-[90vh] flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl"
        >
          <DialogHeader className="pt-6 pb-4 px-6 space-y-1 shrink-0">
            <DialogTitle className="text-2xl text-center font-bold text-zinc-900 dark:text-zinc-100">
              {isCreate ? t("server.header.add") : t("server.header.edit")}
            </DialogTitle>
            <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm">
              {isCreate
                ? t("server.header.addDesc")
                : t("server.header.editDesc")}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onFormSubmit, onFormInvalid)} className="flex flex-col flex-1 min-h-0">
              <div className="flex min-h-0 flex-1 flex-col border-t border-zinc-200 dark:border-zinc-800 sm:flex-row">
              <nav
                aria-label={t("server.categoriesAria")}
                className="flex shrink-0 gap-1 overflow-x-auto border-b border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-[#2b2d31] sm:w-52 sm:flex-col sm:overflow-y-auto sm:overflow-x-visible sm:border-b-0 sm:border-r sm:p-3"
              >
                {SERVER_TABS.map(({ id, title, icon: TabIcon }) => (
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
              <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-4">
              <div role="tabpanel" className={tab === "connection" ? "space-y-4" : "hidden"}>
              <FormField
                control={form.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">
                      {t("server.field.logo")}
                    </FormLabel>
                    <FormControl>
                      <ServerLogoField value={field.value || ""} onChange={field.onChange} disabled={isLoading} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">
                      {t("server.field.name")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10"
                        placeholder={t("server.field.namePlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <FormField
                    control={form.control}
                    name="host"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">
                          {t("server.field.host")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            disabled={isLoading}
                            className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10"
                            placeholder="127.0.0.1"
                            {...field}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (val.includes(':')) {
                                const [h, p] = val.split(':');
                                field.onChange(h);
                                form.setValue('port', parseInt(p) || 6667, { shouldDirty: true });
                                setTimeout(() => {
                                  document.getElementById("edit-port-input")?.focus();
                                }, 0);
                              } else {
                                field.onChange(val);
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="col-span-1">
                  <FormField
                    control={form.control}
                    name="port"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">
                          {t("server.field.port")}
                        </FormLabel>
                        <FormControl>
                          <Input
                            id="edit-port-input"
                            type="number"
                            disabled={isLoading}
                            className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10"
                            placeholder="6667"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">
                      {t("server.field.password")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        disabled={isLoading}
                        className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10 w-full"
                        placeholder={t("server.field.optional")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">
                      {t("server.field.username")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10 w-full"
                        placeholder={t("server.field.identPlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="realname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider">
                      {t("server.field.realName")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        disabled={isLoading}
                        className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10 w-full"
                        placeholder={t("server.field.realNamePlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-2">
                <FormLabel className="uppercase text-xs font-bold text-zinc-600 dark:text-zinc-300 tracking-wider flex items-center justify-between">
                  {t("server.field.nicknames")}
                  <Plus 
                    className="w-4 h-4 cursor-pointer text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100 transition" 
                    onClick={() => appendNick({ value: "" })} 
                  />
                </FormLabel>
                {nickFields.map((field, index) => (
                  <FormField
                    key={field.id}
                    control={form.control}
                    name={`nicknames.${index}.value`}
                    render={({ field }) => (
                      <FormItem>
                        <FormControl>
                          <div className="flex items-center gap-2">
                            <Input
                              disabled={isLoading}
                              className="bg-zinc-100 dark:bg-[#1e1f22] border border-zinc-300/80 dark:border-zinc-700/60 focus-visible:ring-2 focus-visible:ring-indigo-500 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 font-medium h-10"
                              placeholder={index === 0 ? "ReactUser" : t("server.field.fallbackNick")}
                              {...field}
                            />
                            {index > 0 && (
                              <Trash 
                                className="w-4 h-4 cursor-pointer text-zinc-400 hover:text-rose-500 transition shrink-0" 
                                onClick={() => removeNick(index)} 
                              />
                            )}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>

              <FormField
                control={form.control}
                name="useTls"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border border-zinc-300/80 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-3.5 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-semibold text-zinc-900 dark:text-zinc-200 cursor-pointer">
                        {t("server.field.tls")}
                      </FormLabel>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {t("server.field.tlsDesc")}
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked && form.getValues("port") === 6667) {
                            form.setValue("port", 6697, { shouldDirty: true });
                          } else if (!checked && form.getValues("port") === 6697) {
                            form.setValue("port", 6667, { shouldDirty: true });
                          }
                        }}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              </div>
              <div role="tabpanel" className={tab === "behavior" ? "space-y-4" : "hidden"}>
              <FormField
                control={form.control}
                name="autoConnect"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border border-zinc-300/80 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-3.5 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-semibold text-zinc-900 dark:text-zinc-200 cursor-pointer">
                        {t("server.field.autoConnect")}
                      </FormLabel>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {t("server.field.autoConnectDesc")}
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="autoReconnect"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border border-zinc-300/80 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-3.5 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-semibold text-zinc-900 dark:text-zinc-200 cursor-pointer">
                        {t("server.field.autoReconnect")}
                      </FormLabel>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {t("server.field.autoReconnectDesc")}
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="parseLegacyZncTimestamps"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-xl border border-zinc-300/80 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-3.5 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel className="text-sm font-semibold text-zinc-900 dark:text-zinc-200 cursor-pointer">
                        {t("server.field.zncTimestamps")}
                      </FormLabel>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {t("server.field.zncTimestampsDesc")}
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              </div>
              <div role="tabpanel" className={tab === "chat" ? "space-y-4" : "hidden"}>
              {/* SECTION: MOTD POLICY */}
              <div className="flex flex-col rounded-xl border border-zinc-300/80 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-3.5 space-y-2.5 shadow-sm">
                <div className="flex items-center gap-x-2">
                  <ScrollText className="w-4 h-4 text-indigo-500" />
                  <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">
                    {t("server.field.motd")}
                  </label>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {t("server.field.motdDesc")}
                </p>
                <select
                  value={motdPolicyOverride}
                  onChange={(e) => {
                    const val = e.target.value as ServerMotdDisplayPolicy;
                    if (val === "never_globally") {
                      setGlobalMotdPolicy("never");
                      setMotdPolicyOverride("never_globally");
                    } else {
                      setMotdPolicyOverride(val);
                    }
                  }}
                  className="w-full bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="default">
                    {t("server.motd.defaultGlobal", { value: globalMotdPolicy === "always" ? t("server.motd.always") : globalMotdPolicy === "never" ? t("server.motd.dontShowAll") : t("server.motd.whenChangedShort") })}
                  </option>
                  <option value="on_change">{t("server.motd.whenChanged")}</option>
                  <option value="always">{t("server.motd.alwaysOnConnect")}</option>
                  <option value="never">{t("server.motd.dontShowThisServer")}</option>
                  <option value="never_globally">{t("server.motd.dontShowAll")}</option>
                </select>
              </div>

              {/* SECTION: DISPLAY NAME MODE OVERRIDE */}
              <div className="flex flex-col rounded-xl border border-zinc-300/80 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-3.5 space-y-2.5 shadow-sm">
                <div className="flex items-center gap-x-2">
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">
                    {t("server.field.displayName")}
                  </label>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {t("server.field.displayNameDesc")}
                </p>
                <select
                  value={displayNameModeOverride}
                  onChange={(e) => setDisplayNameModeOverride(e.target.value as ServerUserDisplayNameMode)}
                  className="w-full bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="default">
                    {t("server.opt.defaultAppSetting")}
                  </option>
                  <option value="nickname">{t("server.opt.nickname")}</option>
                  <option value="realname">{t("server.opt.realName")}</option>
                  <option value="username">{t("server.opt.username")}</option>
                </select>
              </div>

              {/* SECTION: IMAGE COLLAPSE OVERRIDE */}
              <div className="flex flex-col rounded-xl border border-zinc-300/80 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-3.5 space-y-2.5 shadow-sm">
                <div className="flex items-center gap-x-2">
                  <EyeOff className="w-4 h-4 text-indigo-500" />
                  <label className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">
                    {t("server.field.imageCollapse")}
                  </label>
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  {t("server.field.imageCollapseDesc")}
                </p>
                <select
                  value={mediaCollapseOverride}
                  onChange={(e) => setMediaCollapseOverride(e.target.value as ServerMediaCollapseMode)}
                  className="w-full bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="default">
                    Default (Use app setting: {autoCollapseImages ? t("server.opt.collapsed") : t("server.opt.expanded")})
                  </option>
                  <option value="expanded">{t("server.opt.alwaysExpanded")}</option>
                  <option value="collapsed">{t("server.opt.alwaysCollapsed")}</option>
                </select>
              </div>

              {/* SECTION: REPLY FORMAT */}
              <FormField
                control={form.control}
                name="replyMode"
                render={({ field }) => (
                  <FormItem className="flex flex-col rounded-xl border border-zinc-300/80 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-3.5 space-y-2.5 shadow-sm">
                    <div className="flex items-center gap-x-2">
                      <Reply className="w-4 h-4 text-indigo-500" />
                      <FormLabel className="text-sm font-semibold text-zinc-900 dark:text-zinc-200 cursor-pointer">
                        {t("server.field.replyFormat")}
                      </FormLabel>
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                      {t("server.field.replyFormatDesc")}
                    </p>
                    <FormControl>
                      <select
                        value={field.value}
                        onChange={field.onChange}
                        className="w-full bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value="inherit">
                          Default (Use app setting: {inheritedReplyModeStr})
                        </option>
                        <option value="auto">{t("server.opt.autoRecommended")}</option>
                        <option value="modern">{t("server.opt.modernOnly")}</option>
                        <option value="legacy">{t("server.opt.legacyOnly")}</option>
                        <option value="hybrid">{t("server.opt.hybrid")}</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>
              <div role="tabpanel" className={tab === "notifications" ? "space-y-4" : "hidden"}>
              {/* SECTION: SERVER NOTIFICATION OVERRIDES */}
              <NotificationSettingsFields
                mode="server"
                values={{
                  channelNotifications: channelNotificationsOverride,
                  dmNotifications: dmNotificationsOverride,
                  sound: soundOverride,
                  soundPreset: soundPresetOverride,
                  dmSoundPreset: dmSoundPresetOverride,
                  customSoundUrl: customSoundUrlOverride,
                  customDmSoundUrl: customDmSoundUrlOverride,
                  soundCooldown: soundCooldownOverride,
                  popup: popupOverride,
                  taskbar: taskbarOverride,
                }}
                inherited={{
                  channelNotificationsStr: inheritedChannelNotifStr,
                  dmNotificationsStr: inheritedDmNotifStr,
                  soundStr: inheritedSoundStr,
                  soundPresetStr: inheritedSoundPresetStr,
                  dmSoundPresetStr: inheritedDmSoundPresetStr,
                  cooldownSec: inheritedCooldownSec,
                  popupStr: inheritedPopupStr,
                  taskbarStr: inheritedTaskbarStr,
                }}
                onChange={(field, val) => {
                  if (field === "channelNotifications") setChannelNotificationsOverride(val);
                  else if (field === "dmNotifications") setDmNotificationsOverride(val);
                  else if (field === "sound") setSoundOverride(val);
                  else if (field === "soundPreset") setSoundPresetOverride(val);
                  else if (field === "dmSoundPreset") setDmSoundPresetOverride(val);
                  else if (field === "customSoundUrl") setCustomSoundUrlOverride(val);
                  else if (field === "customDmSoundUrl") setCustomDmSoundUrlOverride(val);
                  else if (field === "soundCooldown") setSoundCooldownOverride(val);
                  else if (field === "popup") setPopupOverride(val);
                  else if (field === "taskbar") setTaskbarOverride(val);
                }}
              />
              </div>
              <div role="tabpanel" className={tab === "commands" ? "space-y-4" : "hidden"}>
              <CustomCommandsFields control={form.control} disabled={isLoading} />
              </div>
              </div>
              </div>

              <DialogFooter className="bg-zinc-100/90 dark:bg-[#2b2d31] border-t border-zinc-200 dark:border-zinc-800/80 px-6 py-4 flex items-center justify-between shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleAttemptClose}
                  disabled={isLoading}
                  className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
                >
                  {t("server.btn.cancel")}
                </Button>
                <Button variant="primary" disabled={isLoading} className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 shadow-sm">
                  {isCreate ? t("server.btn.connectAdd") : t("server.btn.save")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Unsaved Changes Confirmation Modal */}
      <Dialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 p-0 overflow-hidden max-w-sm border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl z-[60] animate-in fade-in-0 zoom-in-95 duration-200"
        >
          <div className="pt-6 px-6 flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 dark:bg-amber-500/20 text-amber-500 flex items-center justify-center border border-amber-500/20 shadow-inner animate-pulse">
              <Plus className="w-6 h-6 rotate-45" />
            </div>
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-xl font-bold text-zinc-900 dark:text-zinc-100 text-center">
                {t("server.unsaved.title")}
              </DialogTitle>
              <DialogDescription className="text-center text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm leading-relaxed">
                You have unsaved changes to server settings for <span className="font-semibold text-indigo-600 dark:text-indigo-400">{server?.name}</span>. Do you want to save them before exiting?
              </DialogDescription>
            </DialogHeader>
          </div>
          <DialogFooter className="bg-zinc-100/90 dark:bg-[#2b2d31] border-t border-zinc-200 dark:border-zinc-800/80 px-6 py-4 flex items-center justify-end gap-x-2 mt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setConfirmCloseOpen(false)}
              disabled={isLoading}
              className="text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white text-xs font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              {t("server.btn.cancel")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleForceClose}
              disabled={isLoading}
              className="border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400 text-xs font-medium transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              {t("server.unsaved.discard")}
            </Button>
            <Button
              type="button"
              onClick={form.handleSubmit(saveServer, onFormInvalid)}
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-4 shadow-sm text-xs transition-all duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              {t("server.btn.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
