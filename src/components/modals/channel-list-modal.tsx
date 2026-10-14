import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChannelType } from "@/types";

interface ListedChannel {
  channel: string;
  users: number;
  topic: string;
}

/** Channel list of the server (IRC LIST), like HexChat's: filter, minimum users, join on click. */
export const ChannelListModal = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isOpen, onClose, type, data } = useModal();
  const isModalOpen = isOpen && type === "channelList";
  const serverId = data.server?.id;
  const serverConnected = useMockStore((state) => !!(serverId && state.ircConnectedServers[serverId]));

  const [channels, setChannels] = useState<ListedChannel[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [minUsers, setMinUsers] = useState("");

  const request = () => {
    if (!serverId) return;
    setChannels([]);
    setLoading(true);
    invoke("request_channel_list", { serverId }).catch(() => setLoading(false));
  };

  // Collect the replies while the modal is open: 321 starts, 322 lists a channel, 323 ends.
  useEffect(() => {
    if (!isModalOpen || !serverId) return;
    let unlisteners: UnlistenFn[] = [];
    let cancelled = false;

    const setup = async () => {
      const offStart = await listen<{ server_id: string }>("irc_list_start", (e) => {
        if (e.payload.server_id !== serverId) return;
        setChannels([]);
        setLoading(true);
      });
      const offItem = await listen<{ server_id: string; channel: string; users: number; topic: string }>(
        "irc_list_item",
        (e) => {
          if (e.payload.server_id !== serverId) return;
          const { channel, users, topic } = e.payload;
          setChannels((prev) => [...prev, { channel, users, topic }]);
        }
      );
      const offEnd = await listen<{ server_id: string }>("irc_list_end", (e) => {
        if (e.payload.server_id !== serverId) return;
        setLoading(false);
      });
      unlisteners = [offStart, offItem, offEnd];
      if (cancelled) unlisteners.forEach((off) => off());
    };
    setup();
    request();

    return () => {
      cancelled = true;
      unlisteners.forEach((off) => off());
    };
    // request is stable enough for this effect: it only depends on serverId.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen, serverId]);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const min = Number(minUsers) || 0;
    return channels
      .filter((c) => c.users >= min)
      .filter((c) => !needle || c.channel.toLowerCase().includes(needle) || c.topic.toLowerCase().includes(needle))
      .sort((a, b) => b.users - a.users || a.channel.localeCompare(b.channel));
  }, [channels, filter, minUsers]);

  const totalUsers = useMemo(() => channels.reduce((sum, c) => sum + c.users, 0), [channels]);

  const join = async (name: string) => {
    if (!serverId) return;
    const store = useMockStore.getState();
    const clean = name.replace(/^#/, "");
    store.setPendingJoin(serverId, clean);
    const created = store.addChannel(serverId, clean, ChannelType.TEXT);
    try {
      await invoke("join_channel", { serverId, channel: clean, password: null });
    } catch (err) {
      console.error("Failed to join from channel list:", err);
    }
    onClose();
    if (created?.id) navigate(`/servers/${serverId}/channels/${created.id}`);
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("cl.title")}</DialogTitle>
          <DialogDescription>
            {loading
              ? t("cl.loading")
              : t("cl.summary", { channels: channels.length, users: totalUsers })}
          </DialogDescription>
        </DialogHeader>

        {!serverConnected && <p className="text-xs text-amber-600 dark:text-amber-400">{t("cl.notConnected")}</p>}

        <div className="flex items-center gap-x-2">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("cl.find")}
            className="h-8 text-xs"
          />
          <Input
            value={minUsers}
            onChange={(e) => setMinUsers(e.target.value.replace(/\D/g, ""))}
            placeholder={t("cl.minUsers")}
            inputMode="numeric"
            className="h-8 w-28 text-xs"
          />
          <Button type="button" variant="secondary" size="sm" onClick={request} disabled={!serverConnected || loading}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {t("cl.refresh")}
          </Button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-700">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-zinc-100 dark:bg-[#2b2d31] text-zinc-600 dark:text-zinc-300">
              <tr>
                <th className="px-2 py-1.5 font-semibold">{t("cl.colChannel")}</th>
                <th className="px-2 py-1.5 font-semibold text-right">{t("cl.colUsers")}</th>
                <th className="px-2 py-1.5 font-semibold">{t("cl.colTopic")}</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.channel} className="border-t border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700/30">
                  <td className="px-2 py-1 font-mono text-zinc-800 dark:text-zinc-100">{c.channel}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{c.users}</td>
                  <td className="px-2 py-1 max-w-[18rem] truncate text-zinc-600 dark:text-zinc-400" title={c.topic}>
                    {c.topic}
                  </td>
                  <td className="px-2 py-1 text-right">
                    <Button type="button" size="sm" variant="ghost" disabled={!serverConnected} onClick={() => join(c.channel)}>
                      {t("cl.join")}
                    </Button>
                  </td>
                </tr>
              ))}
              {!loading && visible.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-2 py-6 text-center text-zinc-500 dark:text-zinc-400">
                    {t("cl.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
};
