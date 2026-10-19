import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Copy, Forward, Orbit, Trash2, Users } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { UserAvatar } from "@/components/user-avatar";
import { AvatarUpload } from "@/components/server/avatar-upload";
import { useModal } from "@/hooks/use-modal-store";
import { useIsMobileShell } from "@/hooks/use-mobile-platform";
import { ExtensionsSettings } from "@/components/modals/extensions-settings";
import { useLunaLogStore, type LunaLogEntry } from "@/hooks/use-luna-log-store";
import { useLunaPeerStore } from "@/hooks/use-luna-peer-store";
import { useMockStore } from "@/lib/mock-store";
import { announceOwnAvatar } from "@/lib/avatars";
import { reannounceHello } from "@/lib/luna-peers";
import { copyToClipboard } from "@/lib/system-utils";
import { cn } from "@/lib/utils";

type LunaTab = "settings" | "peers" | "extensions" | "log";

const TABS: LunaTab[] = ["settings", "peers", "extensions", "log"];
/** Long lines (avatar data) are cut on screen; copying keeps them whole. */
const SHOWN_CHARS = 220;

const SwitchRow = ({
  icon,
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) => (
  <div className="flex flex-row items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 shadow-sm">
    <div className="space-y-0.5 pr-4">
      <div className="flex items-center gap-x-2">
        {icon}
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</span>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{description}</p>
    </div>
    <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
  </div>
);

const pad = (value: number, length = 2) => String(value).padStart(length, "0");
const clock = (time: number) => {
  const date = new Date(time);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`;
};
const formatEntry = (entry: LunaLogEntry) => `${clock(entry.time)} ${entry.dir === "tx" ? ">>" : "<<"} ${entry.text}`;

/** Everything Luna-to-Luna in one place: the switches, who is a Luna, and the log of what was said. */
export const LunaModal = () => {
  const { t } = useTranslation();
  const { isOpen, onClose, type } = useModal();
  const isModalOpen = isOpen && type === "luna";
  const [tab, setTab] = useState<LunaTab>("settings");
  // Extensions are desktop-only for now.
  const isMobile = useIsMobileShell();
  const tabs = isMobile ? TABS.filter((id) => id !== "extensions") : TABS;

  const servers = useMockStore((state) => state.servers);
  const lunaHandshake = useMockStore((state) => state.lunaHandshake);
  const setLunaHandshake = useMockStore((state) => state.setLunaHandshake);
  const experimentalAvatars = useMockStore((state) => state.experimentalAvatars);
  const setExperimentalAvatars = useMockStore((state) => state.setExperimentalAvatars);
  const experimentalForward = useMockStore((state) => state.experimentalForward);
  const setExperimentalForward = useMockStore((state) => state.setExperimentalForward);
  const setServerAvatarsEnabled = useMockStore((state) => state.setServerAvatarsEnabled);

  const peers = useLunaPeerStore((state) => state.peers);
  const entries = useLunaLogStore((state) => state.entries);
  const clearLog = useLunaLogStore((state) => state.clear);

  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  useEffect(() => {
    const list = listRef.current;
    if (tab === "log" && list && stickRef.current) list.scrollTop = list.scrollHeight;
  }, [entries, tab, isModalOpen]);

  const serverName = (serverId: string) => servers.find((s) => s.id === serverId)?.name ?? serverId;
  const peerRows = Object.entries(peers)
    .map(([key, peer]) => {
      const at = key.indexOf("|");
      return { key, serverId: key.slice(0, at), nick: key.slice(at + 1), peer };
    })
    .sort((a, b) => a.serverId.localeCompare(b.serverId) || a.nick.localeCompare(b.nick));

  const toggleServerAvatars = (serverId: string, enabled: boolean) => {
    setServerAvatarsEnabled(serverId, enabled);
    if (enabled) {
      // Peers learn the new feature from a fresh hello, then pick up our avatar.
      reannounceHello(serverId);
      announceOwnAvatar(serverId);
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-x-2">
            <Orbit className="h-5 w-5 text-indigo-500" />
            {t("luna.title")}
          </DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">{t("luna.desc")}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-x-1 border-b border-zinc-200 dark:border-zinc-800">
          {tabs.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition",
                tab === id
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              )}
            >
              {t(`luna.tabs.${id}`)}
              {id === "peers" && peerRows.length > 0 && (
                <span className="ml-1.5 rounded-full bg-zinc-200 dark:bg-zinc-700 px-1.5 text-xs">{peerRows.length}</span>
              )}
            </button>
          ))}
        </div>

        <div className="h-[55vh] overflow-y-auto pr-1">
          {tab === "settings" && (
            <div className="space-y-4">
              <SwitchRow
                icon={<Orbit className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                title={t("settings.chat.lunaHandshake")}
                description={t("luna.handshakeDesc")}
                checked={lunaHandshake}
                onChange={(enabled: boolean) => {
                  setLunaHandshake(enabled);
                  // Switched on: tell the Luna users we already share channels with.
                  if (enabled) servers.forEach((s) => reannounceHello(s.id));
                }}
              />
              <SwitchRow
                icon={<Users className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                title={t("settings.experimental.avatars")}
                description={t("luna.avatarsDesc")}
                checked={experimentalAvatars}
                onChange={setExperimentalAvatars}
              />
              <SwitchRow
                icon={<Forward className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />}
                title={t("settings.experimental.forward")}
                description={t("settings.experimental.forwardDesc")}
                checked={experimentalForward}
                onChange={setExperimentalForward}
              />

              {experimentalAvatars && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">{t("luna.servers")}</h3>
                  {!lunaHandshake && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">{t("luna.needsHandshake")}</p>
                  )}
                  {servers.length === 0 && <p className="text-xs text-zinc-500">{t("luna.noServers")}</p>}
                  {servers.map((server) => (
                    <div
                      key={server.id}
                      className="rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="pr-4">
                          <p className="text-sm font-semibold">{server.name}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("luna.serverAvatarsDesc")}</p>
                        </div>
                        <Switch
                          checked={!!server.avatarsEnabled}
                          onCheckedChange={(enabled) => toggleServerAvatars(server.id, enabled)}
                        />
                      </div>
                      {server.avatarsEnabled && <AvatarUpload serverId={server.id} />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "peers" && (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("luna.peersDesc")}</p>
              {peerRows.length === 0 ? (
                <p className="p-6 text-center text-sm text-zinc-500">{t("luna.noPeers")}</p>
              ) : (
                peerRows.map(({ key, serverId, nick, peer }) => (
                  <div
                    key={key}
                    className="flex items-center gap-x-3 rounded-lg border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] px-3 py-2"
                  >
                    <UserAvatar name={nick} serverId={serverId} nick={nick} className="h-8 w-8 md:h-8 md:w-8" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{nick}</p>
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        {serverName(serverId)} · Luna {peer.version}
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1">
                      {peer.features
                        .filter((feature) => feature !== "re")
                        .map((feature) => (
                          <span key={feature} className="rounded bg-indigo-500/15 px-1.5 py-0.5 text-[11px] text-indigo-600 dark:text-indigo-300">
                            {t(`luna.feature.${feature}`, { defaultValue: feature })}
                          </span>
                        ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "extensions" && <ExtensionsSettings />}

          {tab === "log" && (
            <div className="flex h-full flex-col gap-y-2">
              <div
                ref={listRef}
                onScroll={(e) => {
                  const el = e.currentTarget;
                  stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
                }}
                className="flex-1 overflow-auto rounded-md bg-zinc-950 p-2 font-mono text-[11px] leading-5"
              >
                {entries.length === 0 ? (
                  <p className="p-4 text-center text-zinc-500">{t("luna.logEmpty")}</p>
                ) : (
                  entries.map((entry) => (
                    <div key={entry.id} className={entry.dir === "tx" ? "text-sky-300" : "text-emerald-300"}>
                      <span className="text-zinc-500">{clock(entry.time)}</span> {entry.dir === "tx" ? ">>" : "<<"}{" "}
                      {servers.length > 1 && <span className="text-zinc-500">[{serverName(entry.serverId)}] </span>}
                      <span className="whitespace-pre-wrap break-all" title={entry.text.length > SHOWN_CHARS ? entry.text : undefined}>
                        {entry.text.length > SHOWN_CHARS ? `${entry.text.slice(0, SHOWN_CHARS)}…` : entry.text}
                      </span>
                    </div>
                  ))
                )}
              </div>
              <div className="flex items-center justify-between gap-x-2">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{t("luna.logNote")}</span>
                <div className="flex gap-x-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => void copyToClipboard(entries.map(formatEntry).join("\n"))}>
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                    {t("rawLog.copy")}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={clearLog}>
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    {t("rawLog.clear")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
