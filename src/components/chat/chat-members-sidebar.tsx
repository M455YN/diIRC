import { Channel, Member, Server } from "@/types";
import { UserAvatar } from "@/components/user-avatar";
import { UserHoverCard, getMemberDisplayName } from "@/components/user-hover-card";
import { useNavigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useMockStore, getServerActiveNick } from "@/lib/mock-store";
import { discoverAvatars } from "@/lib/avatar-ctcp";
import { cn } from "@/lib/utils";
import { UserRoleIcon, getHighestChannelRole } from "@/components/user-role-icon";
import { useUIStore } from "@/hooks/use-ui-store";
import { useModal } from "@/hooks/use-modal-store";
import { ActionTooltip } from "@/components/action-tooltip";
import { MoreHorizontal } from "lucide-react";

interface ChatMembersSidebarProps {
  server: Server;
  channel?: Channel;
}

export const ChatMembersSidebar = ({
  server,
  channel
}: ChatMembersSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { onOpen } = useModal();
  const openConversation = useMockStore((state) => state.openConversation);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const channelMembersMap = useMockStore((state) => state.channelMembers);
  const channelUserModesMap = useMockStore((state) => state.channelUserModes);
  const ircConnectedServers = useMockStore((state) => state.ircConnectedServers);
  const historicalConversations = useMockStore((state) => state.historicalConversations);
  const directMessagesMap = useMockStore((state) => state.directMessages);
  const awayUsersMap = useMockStore((state) => state.awayUsers);
  const awayReasonsMap = useMockStore((state) => state.awayReasons);
  const selfAwayMap = useMockStore((state) => state.selfAway);

  const showMembersSidebar = useUIStore((state) => state.showMembersSidebar);

  const isConnected = !!ircConnectedServers[server.id];

  // Active nickname for the server connection
  const ourNick = getServerActiveNick(server);
  // Look for the actual member matching our nick or profileId
  const selfMemberFromStore = server.members.find(
    (m) =>
      m.profileId === currentProfile.id ||
      m.profile.name.toLowerCase() === ourNick.toLowerCase()
  );
  // Always display ourselves — if not in store yet (e.g. server still loading),
  // construct a synthetic entry from our profile data
  const selfMember: Member = selfMemberFromStore ?? {
    id: `self-${server.id}`,
    profileId: currentProfile.id,
    profile: {
      ...currentProfile,
      name: ourNick,
    },
    serverId: server.id,
  };

  // Exclude ourselves from other members list by nick and profileId
  const selfNickLower = selfMember.profile.name.toLowerCase();
  const isNotSelf = (m: Member) =>
    m.profileId !== currentProfile.id &&
    m.profile.name.toLowerCase() !== selfNickLower;

  // Determine list of remaining users to display:
  // in channel mode: filter members in this channel
  // in PM mode: show active conversation partners
  let otherMembers: Member[];
  if (channel) {
    const channelUserNicks = channelMembersMap[channel.id];
    if (channelUserNicks && channelUserNicks.length > 0) {
      const channelUsersSet = new Set(channelUserNicks.map((u) => u.toLowerCase()));
      otherMembers = server.members.filter(
        (m) => channelUsersSet.has(m.profile.name.toLowerCase()) && isNotSelf(m)
      );
    } else {
      otherMembers = server.members.filter(isNotSelf);
    }
  } else {
    const activeMemberIds = (historicalConversations[server.id] || []).filter(
      (memberId) => memberId !== selfMember?.id
    );
    otherMembers = activeMemberIds
      .map((memberId) => server.members.find((m) => m.id === memberId))
      .filter((m): m is NonNullable<typeof m> => {
        if (!m || !isNotSelf(m)) return false;
        if (!selfMember) return false;
        const convId = [selfMember.id, m.id].sort().join("-");
        const msgs = directMessagesMap[convId];
        if (msgs !== undefined && msgs.length === 0) return false;
        return true;
      });
  }

  if (channel) {
    otherMembers = otherMembers.sort((a, b) => {
      const nameA = getMemberDisplayName(a, server);
      const nameB = getMemberDisplayName(b, server);
      return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    });
  } else {
    otherMembers = otherMembers.sort((a, b) => {
      if (!selfMember) return 0;
      const convIdA = [selfMember.id, a.id].sort().join("-");
      const convIdB = [selfMember.id, b.id].sort().join("-");
      const msgsA = directMessagesMap[convIdA] || [];
      const msgsB = directMessagesMap[convIdB] || [];
      const lastMsgA = msgsA[msgsA.length - 1];
      const lastMsgB = msgsB[msgsB.length - 1];
      const timeA = lastMsgA ? new Date(lastMsgA.createdAt).getTime() : 0;
      const timeB = lastMsgB ? new Date(lastMsgB.createdAt).getTime() : 0;
      
      if (timeA !== timeB) return timeB - timeA; // Descending (newest first)
      
      // Fallback to alphabetical
      const nameA = getMemberDisplayName(a, server);
      const nameB = getMemberDisplayName(b, server);
      return nameA.localeCompare(nameB, undefined, { sensitivity: "base" });
    });
  }

  const totalCount = 1 + otherMembers.length;
  const nickKey = otherMembers.map((member) => member.profile.name).join("\n");

  useEffect(() => {
    if (!isConnected || !channel) return;
    discoverAvatars(
      server.id,
      otherMembers.map((member) => member.profile.name)
    );
  }, [isConnected, server.id, channel?.id, nickKey]);

  const onMemberClick = (memberId: string) => {
    if (selfMember?.id === memberId) return;
    openConversation(server.id, memberId);
    navigate(`/servers/${server.id}/conversations/${memberId}`);
  };

  const renderMember = (member: Member, isSelf: boolean = false) => {
    const displayName = getMemberDisplayName(member, server);
    const userModes = channel ? channelUserModesMap[channel.id]?.[member.profile.name.toLowerCase()] || [] : [];
    const highestRole = getHighestChannelRole(userModes);

    const memberNickLower = member.profile.name.toLowerCase();
    const isAway = isSelf
      ? !!selfAwayMap[server.id] || !!awayUsersMap[server.id]?.[ourNick.toLowerCase()] || !!awayUsersMap[server.id]?.[memberNickLower]
      : !!awayUsersMap[server.id]?.[memberNickLower];
    const awayReason = isSelf
      ? awayReasonsMap[server.id]?.[ourNick.toLowerCase()] || awayReasonsMap[server.id]?.[memberNickLower]
      : awayReasonsMap[server.id]?.[memberNickLower];

    return (
      <UserHoverCard member={member} server={server} channel={channel} side="left">
        <div
          onClick={() => onMemberClick(member.id)}
          className="group px-2 py-1 flex items-center gap-x-2 w-full hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 transition cursor-pointer rounded-md"
        >
          <div className="relative shrink-0">
            <UserAvatar 
              src={isSelf ? (server.avatarUrl || member.profile.imageUrl) : member.profile.imageUrl}
              name={displayName}
              className="h-8 w-8 md:h-8 md:w-8"
            />
            {isAway && (
              <ActionTooltip label={awayReason ? `Away: ${awayReason}` : "Away"} side="left">
                <span 
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-yellow-500 dark:bg-yellow-400 rounded-full ring-2 ring-[#F2F3F5] dark:ring-[#2B2D31] cursor-pointer"
                />
              </ActionTooltip>
            )}
          </div>
          <div className="flex flex-col overflow-hidden">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 truncate">
              {displayName}
            </p>
          </div>
          {highestRole && (
            <UserRoleIcon role={highestRole} showTooltip={false} className="ml-auto" />
          )}
        </div>
      </UserHoverCard>
    );
  };

  return (
    <div
      className={cn(
        "relative h-full transition-[width] duration-300 ease-in-out hidden md:block shrink-0 z-10 select-none",
        showMembersSidebar ? "w-60" : "w-0"
      )}
    >
      {/* Sliding Outer Clipping Wrapper */}
      <div className="w-full h-full overflow-hidden border-l border-zinc-200 dark:border-zinc-800 bg-[#F2F3F5] dark:bg-[#2B2D31]">
        <div className="w-60 h-full flex flex-col">
          {/* Scrollable Members / Conversations List */}
          <div className="flex-1 overflow-y-auto pt-4 px-2">
            <div className="mb-6">
              <h3 className="uppercase text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-2 px-2">
                {channel ? "Users" : "Conversations"} — {totalCount}
              </h3>
              <div className={cn("space-y-[2px] transition-all duration-300", !isConnected && "grayscale opacity-60")}>
                {selfMember && (
                  <>
                    <div key={selfMember.id}>{renderMember(selfMember, true)}</div>
                    <div className="my-1.5 border-b border-zinc-200 dark:border-zinc-700/60" />
                  </>
                )}
                {otherMembers.map((member) => (
                  <div key={member.id}>{renderMember(member, false)}</div>
                ))}
              </div>
            </div>
          </div>

          {/* Anchored Bottom Footer for Private Messages */}
          {!channel && (
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-700/60 bg-[#F2F3F5] dark:bg-[#2B2D31] shrink-0 mt-auto">
              <button
                onClick={() => onOpen("privateMessages")}
                className="w-full text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-200/80 dark:bg-zinc-700/80 hover:bg-zinc-300 dark:hover:bg-zinc-600 px-3 py-2 rounded-md transition flex items-center justify-center gap-x-2 shadow-sm cursor-pointer"
                title="More options"
              >
                <MoreHorizontal className="w-4 h-4" />
                More
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

