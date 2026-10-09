import { MoreHorizontal, Plus, Radio, Search, Unplug } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useModal } from "@/hooks/use-modal-store";
import { getServerSelfMember, useMockStore } from "@/lib/mock-store";
import { cn } from "@/lib/utils";
import type { MobileTab } from "./mobile-bottom-nav";
import { SwipeableRow } from "./swipeable-row";

interface MobileServersTabProps {
  onSelectServer: (serverId: string) => void;
  setTab: (tab: MobileTab) => void;
}

export const MobileServersTab = ({ onSelectServer, setTab }: MobileServersTabProps) => {
  const servers = useMockStore((state) => state.servers);
  const ircConnectedServers = useMockStore((state) => state.ircConnectedServers);
  const connectServer = useMockStore((state) => state.connectServer);
  const unreadState = useMockStore((state) => state.unreadState);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const { onOpen } = useModal();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleOpen = (serverId: string) => {
    onSelectServer(serverId);
    setTab("chats");
    navigate(`/servers/${serverId}`);
  };

  const serverHasUnread = (serverId: string) => {
    const server = servers.find((s) => s.id === serverId);
    if (!server) return false;
    for (const channel of server.channels) {
      const info = unreadState[`channel:${channel.id}`];
      if (info && info.count > 0) return true;
    }
    const self = getServerSelfMember(server, currentProfile?.id);
    for (const member of server.members) {
      if (member.id === self.id) continue;
      const convId = [self.id, member.id].sort().join("-");
      const info = unreadState[`conversation:${convId}`];
      if (info && info.count > 0) return true;
    }
    return false;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return servers;
    return servers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.host || "").toLowerCase().includes(q)
    );
  }, [servers, query]);

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      <div className="mobile-safe-top shrink-0 px-5 pt-2">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onOpen("settings")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground"
            aria-label="Menu"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => onOpen("createServer")}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm"
            aria-label="Add server"
          >
            <Plus className="h-5 w-5 stroke-[2.5]" />
          </button>
        </div>

        <h1 className="mb-3 text-[34px] font-bold leading-none tracking-tight">
          Servers
        </h1>

        <label className="mb-2 flex h-11 items-center gap-2 rounded-full bg-secondary px-3.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>

        <p className="mb-1 px-1 text-[12px] text-muted-foreground">
          Swipe right to edit · swipe left to delete
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-28">
        {filtered.length === 0 && (
          <div className="px-4 py-16 text-center">
            <p className="mb-4 text-sm text-muted-foreground">
              No servers yet. Add an IRC server to start chatting.
            </p>
            <button
              type="button"
              onClick={() => onOpen("createServer")}
              className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-sm font-medium text-white"
            >
              <Plus className="h-4 w-4" />
              Add server
            </button>
          </div>
        )}

        {filtered.map((server) => {
          const connected = !!ircConnectedServers[server.id];
          const unread = serverHasUnread(server.id);

          return (
            <SwipeableRow
              key={server.id}
              onEdit={() => onOpen("editServer", { server })}
              onDelete={() => onOpen("deleteServer", { server })}
            >
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button
                  type="button"
                  onClick={() => handleOpen(server.id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-sm font-medium text-blue-500">
                    {server.name.slice(0, 2).toUpperCase()}
                    {unread && (
                      <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-rose-500" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-medium">{server.name}</p>
                    <p className="truncate text-[13px] text-muted-foreground">
                      {server.host
                        ? `${server.host}${server.port ? `:${server.port}` : ""}`
                        : "IRC server"}
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (!connected) connectServer(server.id);
                  }}
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    connected
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-secondary text-muted-foreground"
                  )}
                  aria-label={connected ? "Connected" : "Connect"}
                >
                  {connected ? (
                    <Radio className="h-4 w-4" />
                  ) : (
                    <Unplug className="h-4 w-4" />
                  )}
                </button>
              </div>
            </SwipeableRow>
          );
        })}
      </div>
    </div>
  );
};
