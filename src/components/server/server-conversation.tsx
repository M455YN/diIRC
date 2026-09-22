import { Member, Profile, Server } from "@/types";
import { X, Settings } from "lucide-react";
import { useParams, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { getMemberDisplayName } from "@/components/user-hover-card";
import { ActionTooltip } from "@/components/action-tooltip";
import { useMockStore, getServerSelfMember } from "@/lib/mock-store";
import { useModal } from "@/hooks/use-modal-store";

interface ServerConversationProps {
  member: Member & { profile: Profile };
  server: Server;
}

export const ServerConversation = ({
  member,
  server,
}: ServerConversationProps) => {
  const params = useParams();
  const navigate = useNavigate();
  const { onOpen } = useModal();
  const closeConversation = useMockStore((state) => state.closeConversation);
  const currentProfile = useMockStore((state) => state.currentProfile);

  const awayUsersMap = useMockStore((state) => state.awayUsers);
  const awayReasonsMap = useMockStore((state) => state.awayReasons);

  const memberNickLower = member.profile.name.toLowerCase();
  const isAway = !!awayUsersMap[server.id]?.[memberNickLower];
  const awayReason = awayReasonsMap[server.id]?.[memberNickLower];

  const currentMember = getServerSelfMember(server, currentProfile?.id);

  const conversationId = currentMember ? [currentMember.id, member.id].sort().join("-") : "";
  const isSelected = params?.memberId === member.id;
  const displayName = getMemberDisplayName(member, server);

  const unread = useMockStore(
    (state) => conversationId ? state.unreadState[`conversation:${conversationId}`] : undefined
  );
  const isUnread = !!unread && unread.count > 0;

  const onClick = () => {
    navigate(`/servers/${server.id}/conversations/${member.id}`);
  };

  const onSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentMember) {
      onOpen("channelSettings", { server, conversationId });
    }
  };

  const onClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    closeConversation(server.id, member.id);
    if (isSelected) {
      const defaultChannel = server.channels[0];
      if (defaultChannel) {
        navigate(`/servers/${server.id}/channels/${defaultChannel.id}`);
      } else {
        navigate(`/servers/${server.id}`);
      }
    }
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
    }
  };

  const onAuxClick = (e: React.MouseEvent) => {
    if (e.button === 1) {
      e.preventDefault();
      onClose(e);
    }
  };

  return (
    <button
      onClick={onClick}
      onMouseDown={onMouseDown}
      onAuxClick={onAuxClick}
      className={cn(
        "group px-2 py-2 rounded-md flex items-center gap-x-2 w-full hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 transition mb-1 relative",
        isSelected && "bg-zinc-700/20 dark:bg-zinc-700",
        isUnread && "bg-rose-500/10 dark:bg-rose-500/15"
      )}
    >
      {isUnread && (
        <span className="absolute left-0 w-1.5 h-4 bg-rose-500 rounded-r-full transition-all" />
      )}
      <div className="flex items-center gap-x-2 min-w-0 flex-1">
        <div className="relative shrink-0">
          <UserAvatar
            src={member.profile.imageUrl}
            name={displayName}
            className={cn(
              "h-7 w-7 md:h-7 md:w-7 transition",
              isUnread && "ring-2 ring-rose-500 ring-offset-1 ring-offset-background"
            )}
          />
          {isAway && (
            <ActionTooltip label={awayReason ? `Away: ${awayReason}` : "Away"} side="right">
              <span
                className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-yellow-500 dark:bg-yellow-400 rounded-full ring-2 ring-[#F2F3F5] dark:ring-[#2B2D31] cursor-pointer"
              />
            </ActionTooltip>
          )}
        </div>
        <p
          className={cn(
            "line-clamp-1 text-sm text-left transition flex-1",
            isSelected
              ? "font-semibold text-primary dark:text-zinc-200 dark:group-hover:text-white"
              : isUnread
              ? "font-bold text-zinc-900 dark:text-white drop-shadow-sm"
              : "font-semibold text-zinc-500 group-hover:text-zinc-600 dark:text-zinc-400 dark:group-hover:text-zinc-300"
          )}
        >
          {displayName}
        </p>
      </div>
      {isUnread && (
        <span className="ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500 text-white leading-none shrink-0 shadow-sm shadow-rose-500/30 animate-in zoom-in-50">
          {unread.count}
        </span>
      )}
      <div className="ml-auto flex items-center gap-x-1 shrink-0">
        <ActionTooltip label="PM Settings">
          <Settings
            onClick={onSettings}
            className="hidden group-hover:block w-4 h-4 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition"
          />
        </ActionTooltip>
        <ActionTooltip label="Close PM">
          <X
            onClick={onClose}
            className="hidden group-hover:block w-4 h-4 text-zinc-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 transition"
          />
        </ActionTooltip>
      </div>
    </button>
  );
};
