import { Plus, Radio, Unplug } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMockStore, getServerSelfMember } from "@/lib/mock-store";
import { useModal } from "@/hooks/use-modal-store";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MobileTab } from "./mobile-bottom-nav";

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

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#313338]">
      <div className="mobile-safe-top flex items-center justify-between px-3 mobile-chrome-bar border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Servers</h1>
        <button
          type="button"
          onClick={() => onOpen("createServer")}
          className="h-9 w-9 flex items-center justify-center rounded-lg bg-indigo-600 text-white"
          aria-label="Add server"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {servers.length === 0 && (
            <div className="text-center py-10 px-4">
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-3">
                No servers yet. Add an IRC server to start chatting.
              </p>
              <button
                type="button"
                onClick={() => onOpen("createServer")}
                className="inline-flex items-center gap-2 px-3 h-9 rounded-lg bg-indigo-600 text-white text-sm font-semibold"
              >
                <Plus className="w-4 h-4" />
                Add server
              </button>
            </div>
          )}

          {servers.map((server) => {
            const connected = !!ircConnectedServers[server.id];
            const unread = serverHasUnread(server.id);

            return (
              <div
                key={server.id}
                className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-zinc-50 dark:bg-[#2b2d31] border border-zinc-200/80 dark:border-zinc-800"
              >
                <button
                  type="button"
                  onClick={() => handleOpen(server.id)}
                  className="flex-1 flex items-center gap-2.5 min-w-0 text-left min-h-10"
                >
                  <div
                    className={cn(
                      "relative h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold",
                      "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200"
                    )}
                  >
                    {server.name.slice(0, 2).toUpperCase()}
                    {unread && (
                      <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#2b2d31]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">
                      {server.name}
                    </p>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
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
                    "h-9 w-9 flex items-center justify-center rounded-lg shrink-0",
                    connected
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                  )}
                  aria-label={connected ? "Connected" : "Connect"}
                >
                  {connected ? <Radio className="w-4 h-4" /> : <Unplug className="w-4 h-4" />}
                </button>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};
