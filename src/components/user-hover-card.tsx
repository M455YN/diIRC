import React from "react";
import { Channel, Member, Profile, Server } from "@/types";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { MessageSquare, Bell, BellOff } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useMockStore } from "@/lib/mock-store";
import { UserRoleIcon, getHighestChannelRole } from "@/components/user-role-icon";
import { UserContextMenu } from "@/components/user-context-menu";
import { cn } from "@/lib/utils";

interface UserHoverCardProps {
  member: Member & { profile: Profile };
  server?: Server;
  channel?: Channel;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

import { getMemberDisplayName } from "@/lib/display-name-utils";
export { getMemberDisplayName };


export const UserHoverCard = ({
  member,
  server,
  channel: customChannel,
  children,
  side = "right",
  align = "start",
}: UserHoverCardProps) => {
  const params = useParams();
  const navigate = useNavigate();
  const currentProfile = useMockStore((state) => state.currentProfile);
  const servers = useMockStore((state) => state.servers);
  const openConversation = useMockStore((state) => state.openConversation);
  const channelUserModesMap = useMockStore((state) => state.channelUserModes);
  const awayUsersMap = useMockStore((state) => state.awayUsers);
  const awayReasonsMap = useMockStore((state) => state.awayReasons);
  const awayWatchMap = useMockStore((state) => state.awayWatch);
  const watchAway = useMockStore((state) => state.watchAway);
  const unwatchAway = useMockStore((state) => state.unwatchAway);

  const activeServer = server || servers[0];
  const freshMember = activeServer?.members.find(
    (m) => m.id === member.id || m.profile.name.toLowerCase() === member.profile.name.toLowerCase()
  ) || member;

  const activeChannel = customChannel || activeServer?.channels.find((c) => c.id === params?.channelId);
  const nickname = freshMember.profile.name;

  const isAway = activeServer ? !!awayUsersMap[activeServer.id]?.[nickname.toLowerCase()] : false;
  const awayReason = activeServer ? awayReasonsMap[activeServer.id]?.[nickname.toLowerCase()] : undefined;
  const isAwayWatched = activeServer
    ? (awayWatchMap[activeServer.id] || []).includes(nickname.toLowerCase())
    : false;

  const userModes = activeChannel ? channelUserModesMap[activeChannel.id]?.[nickname.toLowerCase()] || [] : [];
  const highestRole = getHighestChannelRole(userModes);

  const displayName = getMemberDisplayName(freshMember, activeServer);
  const isSelf =
    freshMember.profileId === currentProfile.id ||
    (activeServer?.nicknames?.[0] &&
      freshMember.profile.name.toLowerCase() === activeServer.nicknames[0].toLowerCase());

  const onToggleAwayWatch = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!activeServer || isSelf) return;
    if (isAwayWatched) {
      unwatchAway(activeServer.id, nickname);
    } else {
      watchAway(activeServer.id, nickname);
    }
  };

  const onOpenDM = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    if (!activeServer) return;

    let targetMember = activeServer.members.find(
      (m) => m.id === freshMember.id || m.profile.name.toLowerCase() === freshMember.profile.name.toLowerCase()
    );

    if (!targetMember) {
      targetMember = useMockStore.getState().addServerMember(activeServer.id, nickname);
    }

    if (!targetMember) return;

    openConversation(activeServer.id, targetMember.id);
    navigate(`/servers/${activeServer.id}/conversations/${targetMember.id}`);
  };

  return (
    <HoverCard openDelay={150} closeDelay={300}>
      <UserContextMenu member={freshMember} server={activeServer} channel={activeChannel}>
        <HoverCardTrigger asChild>
          {children}
        </HoverCardTrigger>
      </UserContextMenu>
      <HoverCardContent
        side={side}
        align={align}
        sideOffset={4}
        className="w-72 p-4 shadow-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1e1f22]"
      >
        <div className="space-y-3.5">
          {/* Top Row: Avatar & Action Button */}
          <div className="flex items-center justify-between">
            <UserAvatar
              src={freshMember.profile.imageUrl}
              name={displayName}
              className="h-14 w-14 md:h-14 md:w-14 shadow-sm"
            />
            {activeServer && (
              <Button
                onClick={onOpenDM}
                size="sm"
                className="h-8 gap-x-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium shadow-sm transition"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                {isSelf ? "Message yourself" : "Message"}
              </Button>
            )}
          </div>

          {/* User Names & Details */}
          <div className="space-y-0.5">
            <div className="flex items-center justify-between gap-x-2">
              <h4 className="font-semibold text-base text-zinc-900 dark:text-zinc-100 leading-tight truncate">
                {displayName}
              </h4>
              {highestRole && (
                <UserRoleIcon role={highestRole} showLabel showTooltip={false} />
              )}
            </div>
            <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              @{nickname}
            </p>
          </div>

          {/* Additional details section */}
          <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1.5">
            {isAway && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-yellow-600 dark:text-yellow-400 font-semibold">
                  <span>Status:</span>
                  <span className="truncate max-w-[160px]">{awayReason ? `Away (${awayReason})` : "Away"}</span>
                </div>
                {!isSelf && activeServer && (
                  <button
                    type="button"
                    onClick={onToggleAwayWatch}
                    className={cn(
                      "w-full flex items-center justify-center gap-x-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition",
                      isAwayWatched
                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25"
                    )}
                  >
                    {isAwayWatched ? (
                      <>
                        <BellOff className="w-3.5 h-3.5" />
                        Cancel notify when available
                      </>
                    ) : (
                      <>
                        <Bell className="w-3.5 h-3.5" />
                        Notify when available
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
            {!isAway && isAwayWatched && !isSelf && activeServer && (
              <button
                type="button"
                onClick={onToggleAwayWatch}
                className="w-full flex items-center justify-center gap-x-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                <BellOff className="w-3.5 h-3.5" />
                Cancel notify when available
              </button>
            )}
            <div className="flex justify-between">
              <span className="font-medium">Username:</span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300">{nickname}</span>
            </div>
            {displayName !== nickname && (
              <div className="flex justify-between">
                <span className="font-medium">RealName:</span>
                <span className="font-sans text-zinc-700 dark:text-zinc-300">{displayName}</span>
              </div>
            )}
            {freshMember.profile.host && (
              <div className="flex justify-between items-center gap-x-2">
                <span className="font-medium">Host:</span>
                <span
                  className="font-mono text-zinc-700 dark:text-zinc-300 truncate max-w-[170px]"
                  title={freshMember.profile.host}
                >
                  {freshMember.profile.host}
                </span>
              </div>
            )}
          </div>
        </div>
      </HoverCardContent>
      </HoverCard>
  );
};

