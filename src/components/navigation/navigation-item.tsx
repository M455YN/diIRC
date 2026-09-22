import { useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PlusCircle, Settings, Trash, Unplug, Radio } from "lucide-react";

import { cn } from "@/lib/utils";
import { ActionTooltip } from "@/components/action-tooltip";
import { useMockStore, getServerSelfMember } from "@/lib/mock-store";
import { useModalStore } from "@/hooks/use-modal-store";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

interface NavigationItemProps {
  id: string;
  imageUrl: string;
  name: string;
  index: number;
  isDragging?: boolean;
  isAnyDragging?: boolean;
  dropPosition?: "above" | "below" | null;
  onPointerDown?: (e: React.PointerEvent, id: string, index: number) => void;
}

export const NavigationItem = ({
  id,
  imageUrl,
  name,
  index,
  isDragging,
  isAnyDragging,
  dropPosition,
  onPointerDown,
}: NavigationItemProps) => {
  const params = useParams();
  const navigate = useNavigate();

  const onClick = () => {
    const store = useMockStore.getState();
    const lastActive = store.lastActiveChatPerServer[id];
    const targetServer = store.servers.find((s) => s.id === id);

    if (lastActive && targetServer) {
      if (lastActive.type === "channel" && targetServer.channels.some((c) => c.id === lastActive.id)) {
        navigate(`/servers/${id}/channels/${lastActive.id}`);
      } else if (lastActive.type === "conversation" && targetServer.members.some((m) => m.id === lastActive.id)) {
        navigate(`/servers/${id}/conversations/${lastActive.id}`);
      } else if (targetServer.channels.length > 0) {
        navigate(`/servers/${id}/channels/${targetServer.channels[0].id}`);
      } else {
        navigate(`/servers/${id}`);
      }
    } else if (targetServer && targetServer.channels.length > 0) {
      navigate(`/servers/${id}/channels/${targetServer.channels[0].id}`);
    } else {
      navigate(`/servers/${id}`);
    }

    const motd = store.serverMotds[id];
    if (motd && motd.length > 0 && store.shouldAutoShowMotd(id, motd)) {
      useModalStore.getState().onOpen("motd", {
        server: targetServer,
        serverId: id,
        motd,
      });
      store.markServerMotdSeen(id, motd);
    }
  };

  const isSelected = params?.serverId === id;

  const unreadState = useMockStore((state) => state.unreadState);
  const server = useMockStore((state) => state.servers.find((s) => s.id === id));
  const isIrcConnected = useMockStore((state) => !!state.ircConnectedServers[id]);
  const connectServer = useMockStore((state) => state.connectServer);
  const { onOpen } = useModalStore();

  let totalUnread = 0;
  let hasMention = false;

  if (server) {
    for (const channel of server.channels) {
      const info = unreadState[`channel:${channel.id}`];
      if (info && info.count > 0) {
        totalUnread += info.count;
        if (info.hasMention) hasMention = true;
      }
    }
    const currentMember = getServerSelfMember(server, useMockStore.getState().currentProfile?.id);
    for (const member of server.members) {
      if (member.id === currentMember.id) continue;
      const convId = [currentMember.id, member.id].sort().join("-");
      const info = unreadState[`conversation:${convId}`];
      if (info && info.count > 0) {
        totalUnread += info.count;
        if (info.hasMention) hasMention = true;
      }
    }
  }

  const isUnread = totalUnread > 0;
  const tooltipLabel = !isIrcConnected ? `${name} (Disconnected)` : name;

  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDownInternal = (e: React.PointerEvent) => {
    if (e.button === 0) {
      pointerDownPos.current = { x: e.clientX, y: e.clientY };
    }
    onPointerDown?.(e, id, index);
  };

  const handleItemClick = (e: React.MouseEvent) => {
    if (pointerDownPos.current) {
      const dist = Math.hypot(e.clientX - pointerDownPos.current.x, e.clientY - pointerDownPos.current.y);
      pointerDownPos.current = null;
      if (dist > 4) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    onClick();
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          data-server-id={id}
          data-server-index={index}
          onPointerDown={handlePointerDownInternal}
          className={cn(
            "relative group transition-opacity duration-150 select-none",
            isDragging && "opacity-30"
          )}
        >
          {dropPosition === "above" && (
            <div className="absolute -top-2 left-2 right-2 flex items-center pointer-events-none z-30 animate-in fade-in-50 duration-100">
              <div className="w-2.5 h-2.5 rounded-full bg-white dark:bg-white ring-2 ring-indigo-500 shadow-md -mr-1 z-10 shrink-0" />
              <div className="flex-1 h-[3.5px] bg-white dark:bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            </div>
          )}
          {dropPosition === "below" && (
            <div className="absolute -bottom-2 left-2 right-2 flex items-center pointer-events-none z-30 animate-in fade-in-50 duration-100">
              <div className="w-2.5 h-2.5 rounded-full bg-white dark:bg-white ring-2 ring-indigo-500 shadow-md -mr-1 z-10 shrink-0" />
              <div className="flex-1 h-[3.5px] bg-white dark:bg-white rounded-full shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            </div>
          )}
          <ActionTooltip
            side="right"
            align="center"
            label={isAnyDragging ? "" : tooltipLabel}
          >
            <div
              role="button"
              tabIndex={0}
              onClick={handleItemClick}
              onKeyDown={(e) => e.key === "Enter" && onClick()}
              className="group relative flex items-center w-full cursor-pointer"
            >
              <div className={cn(
                "absolute left-0 bg-primary rounded-r-full transition-all w-[4px]",
                !isSelected && "group-hover:h-[20px]",
                isSelected ? "h-[36px]" : (isUnread ? "h-[10px]" : "h-[0px]")
              )} />
              <div className={cn(
                "relative group flex mx-3 h-[48px] w-[48px] rounded-[24px] group-hover:rounded-[16px] transition-all overflow-hidden pointer-events-none",
                isSelected && "bg-primary/10 text-primary rounded-[16px]",
                isUnread && "ring-2 ring-indigo-500/80 ring-offset-2 dark:ring-offset-[#1E1F22]",
                !isIrcConnected && "opacity-60 grayscale contrast-75 hover:opacity-90 hover:grayscale-[50%] transition-all"
              )}>
                <img
                  src={imageUrl}
                  alt={name}
                  draggable={false}
                  className="w-full h-full object-cover pointer-events-none"
                />
              </div>
              {!isIrcConnected && (
                <span className="absolute bottom-0 right-2 z-10 w-3 h-3 bg-amber-500 rounded-full ring-2 ring-[#E3E5E8] dark:ring-[#1E1F22]" title="Disconnected" />
              )}
              {isUnread && (
                <span className={cn(
                  "absolute -top-1 right-2 z-10 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white shadow-md ring-2 ring-[#E3E5E8] dark:ring-[#1E1F22] transition-transform animate-in zoom-in-50 pointer-events-none",
                  hasMention ? "bg-rose-500 shadow-rose-500/40" : "bg-indigo-500 shadow-indigo-500/40"
                )}>
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
          </ActionTooltip>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-56 text-xs font-medium text-black dark:text-neutral-400 space-y-[2px]">
        <ContextMenuItem
          onSelect={() => setTimeout(() => server && onOpen("editServer", { server }), 0)}
          className="px-3 py-2 text-sm cursor-pointer"
        >
          Server settings
          <Settings className="h-4 w-4 ml-auto" />
        </ContextMenuItem>
        <ContextMenuItem
          onSelect={() => setTimeout(() => server && onOpen("createChannel", { server }), 0)}
          className="px-3 py-2 text-sm cursor-pointer"
        >
          Join channel
          <PlusCircle className="h-4 w-4 ml-auto" />
        </ContextMenuItem>
        {isIrcConnected ? (
          <ContextMenuItem
            onSelect={() => setTimeout(() => server && onOpen("leaveServer", { server }), 0)}
            className="px-3 py-2 text-sm cursor-pointer text-amber-600 dark:text-amber-400"
          >
            Disconnect from server
            <Unplug className="h-4 w-4 ml-auto" />
          </ContextMenuItem>
        ) : (
          <ContextMenuItem
            onSelect={() => setTimeout(() => connectServer(id), 0)}
            className="px-3 py-2 text-sm cursor-pointer text-emerald-600 dark:text-emerald-400 font-semibold"
          >
            Connect to server
            <Radio className="h-4 w-4 ml-auto" />
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem
          onSelect={() => setTimeout(() => server && onOpen("deleteServer", { server }), 0)}
          className="text-rose-500 px-3 py-2 text-sm cursor-pointer"
        >
          Remove server
          <Trash className="h-4 w-4 ml-auto" />
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};
