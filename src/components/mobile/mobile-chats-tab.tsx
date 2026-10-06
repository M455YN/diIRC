import { useMemo, useState } from "react";
import { Hash, MoreHorizontal, Plus, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { UserAvatar } from "@/components/user-avatar";
import { getMemberDisplayName } from "@/components/user-hover-card";
import { useModal } from "@/hooks/use-modal-store";
import { getServerSelfMember, useMockStore } from "@/lib/mock-store";
import { cn } from "@/lib/utils";

type FilterId = "all" | "channels" | "messages";

type ChatRow = {
  key: string;
  kind: "channel" | "dm";
  title: string;
  preview: string;
  href: string;
  timeLabel: string;
  unread: number;
  imageUrl?: string | null;
  online?: boolean;
};

function formatTime(ts?: number | string | Date | null): string {
  if (!ts) return "";
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { weekday: "short" });
}

interface MobileChatsTabProps {
  serverId?: string;
}

export const MobileChatsTab = ({ serverId }: MobileChatsTabProps) => {
  const navigate = useNavigate();
  const { onOpen } = useModal();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");

  const servers = useMockStore((s) => s.servers);
  const currentProfile = useMockStore((s) => s.currentProfile);
  const activeConversations = useMockStore((s) => s.activeConversations);
  const messages = useMockStore((s) => s.messages);
  const directMessages = useMockStore((s) => s.directMessages);
  const unreadState = useMockStore((s) => s.unreadState);
  const awayUsers = useMockStore((s) => s.awayUsers);

  const server =
    servers.find((s) => s.id === serverId) || (serverId ? undefined : servers[0]);

  const filters: { id: FilterId; label: string }[] = [
    { id: "all", label: "All" },
    { id: "channels", label: "Channels" },
    { id: "messages", label: "Messages" },
  ];

  const rows = useMemo(() => {
    if (!server) return [] as ChatRow[];
    const self = getServerSelfMember(server, currentProfile?.id);
    const list: ChatRow[] = [];

    for (const channel of server.channels) {
      const msgs = messages[channel.id] || [];
      const last = msgs[msgs.length - 1];
      const unread = unreadState[`channel:${channel.id}`]?.count || 0;
      const lastNick = last?.member?.profile?.name;
      list.push({
        key: `ch:${channel.id}`,
        kind: "channel",
        title: channel.name.startsWith("#") ? channel.name : `#${channel.name}`,
        preview: last
          ? `${lastNick || "Someone"}: ${String(last.content || "").slice(0, 80)}`
          : "No messages yet",
        href: `/servers/${server.id}/channels/${channel.id}`,
        timeLabel: formatTime(last?.createdAt),
        unread,
      });
    }

    const openMemberIds = activeConversations[server.id] || [];
    for (const memberId of openMemberIds) {
      const member = server.members.find((m) => m.id === memberId);
      if (!member || member.id === self.id) continue;
      const convId = [self.id, member.id].sort().join("-");
      const msgs = directMessages[convId] || [];
      const last = msgs[msgs.length - 1];
      const unread = unreadState[`conversation:${convId}`]?.count || 0;
      const nick = getMemberDisplayName(member, server);
      const nickLower = member.profile.name.toLowerCase();
      const isAway = !!awayUsers[server.id]?.[nickLower];
      list.push({
        key: `dm:${member.id}`,
        kind: "dm",
        title: nick,
        preview: last
          ? String(last.content || "").slice(0, 80)
          : `Chat with ${nick}`,
        href: `/servers/${server.id}/conversations/${member.id}`,
        timeLabel: formatTime(last?.createdAt),
        unread,
        imageUrl: member.profile.imageUrl,
        online: !isAway,
      });
    }

    list.sort((a, b) => (b.unread > 0 ? 1 : 0) - (a.unread > 0 ? 1 : 0));
    return list;
  }, [
    server,
    currentProfile?.id,
    messages,
    directMessages,
    unreadState,
    activeConversations,
    awayUsers,
  ]);

  const visible = rows.filter((row) => {
    if (filter === "channels" && row.kind !== "channel") return false;
    if (filter === "messages" && row.kind !== "dm") return false;
    if (!query.trim()) return true;
    const q = query.trim().toLowerCase();
    return (
      row.title.toLowerCase().includes(q) ||
      row.preview.toLowerCase().includes(q)
    );
  });

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
            onClick={() =>
              server
                ? onOpen("createChannel", { server })
                : onOpen("createServer")
            }
            className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500 text-white shadow-sm"
            aria-label="New chat"
          >
            <Plus className="h-5 w-5 stroke-[2.5]" />
          </button>
        </div>

        <h1 className="mb-3 text-[34px] font-bold leading-none tracking-tight">
          Chats
        </h1>

        <label className="mb-3 flex h-11 items-center gap-2 rounded-full bg-secondary px-3.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>

        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-2 scrollbar-none">
          {filters.map((f) => {
            const active = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={cn(
                  "shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
                  active
                    ? "bg-secondary text-foreground shadow-[inset_0_-2px_0_0_theme(colors.blue.500)]"
                    : "text-muted-foreground"
                )}
              >
                {f.label}
              </button>
            );
          })}
          {server && (
            <span className="ml-1 self-center truncate text-[12px] font-medium text-muted-foreground">
              {server.name}
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-28">
        {!server && (
          <div className="px-4 py-16 text-center text-sm text-muted-foreground">
            Add a server to see channels and messages.
          </div>
        )}

        {server && visible.length === 0 && (
          <div className="px-4 py-16 text-center text-sm text-muted-foreground">
            No chats match your filters.
          </div>
        )}

        {visible.map((row) => (
          <button
            key={row.key}
            type="button"
            onClick={() => navigate(row.href)}
            className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left active:bg-accent/60"
          >
            <div className="relative shrink-0">
              {row.kind === "dm" ? (
                <UserAvatar
                  src={row.imageUrl || undefined}
                  name={row.title}
                  className="h-12 w-12"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/15 text-blue-500">
                  <Hash className="h-5 w-5" />
                </div>
              )}
              {row.kind === "dm" && row.online && (
                <span className="absolute bottom-0.5 right-0.5 h-3 w-3 rounded-full border-2 border-background bg-emerald-500" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-[16px] font-semibold text-foreground">
                  {row.title}
                </p>
                <span className="shrink-0 text-[12px] text-muted-foreground">
                  {row.timeLabel}
                </span>
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <p className="truncate text-[13px] text-muted-foreground">
                  {row.preview}
                </p>
                {row.unread > 0 && (
                  <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[11px] font-bold text-white">
                    {row.unread > 99 ? "99+" : row.unread}
                  </span>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
