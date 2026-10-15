import React from "react";
import { useTranslation } from "react-i18next";
import { Channel, Member, Profile, Server } from "@/types";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { UserAvatar } from "@/components/user-avatar";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useMockStore, getServerActiveNick } from "@/lib/mock-store";
import { UserRoleIcon, getHighestChannelRole } from "@/components/user-role-icon";
import { UserContextMenu } from "@/components/user-context-menu";

interface UserHoverCardProps {
  member: Member & { profile: Profile };
  server?: Server;
  channel?: Channel;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

import { getMemberDisplayName } from "@/lib/display-name-utils";
import { translateAwayReason } from "@/lib/system-message-i18n";
export { getMemberDisplayName };


export const UserHoverCard = ({
  member,
  server,
  channel: customChannel,
  children,
  side = "right",
  align = "start",
}: UserHoverCardProps) => {
  const { t } = useTranslation();
  const params = useParams();
  const navigate = useNavigate();
  const currentProfile = useMockStore((state) => state.currentProfile);
  const servers = useMockStore((state) => state.servers);
  const openConversation = useMockStore((state) => state.openConversation);
  const channelUserModesMap = useMockStore((state) => state.channelUserModes);
  const awayUsersMap = useMockStore((state) => state.awayUsers);
  const awayReasonsMap = useMockStore((state) => state.awayReasons);
  const selfAwayMap = useMockStore((state) => state.selfAway);
  const selfAwayReasonsMap = useMockStore((state) => state.selfAwayReasons);

  const activeServer = server || servers[0];
  const freshMember = activeServer?.members.find(
    (m) => m.id === member.id || m.profile.name.toLowerCase() === member.profile.name.toLowerCase()
  ) || member;

  const activeChannel = customChannel || activeServer?.channels.find((c) => c.id === params?.channelId);
  const nickname = freshMember.profile.name;

  const ourNickLower = activeServer ? getServerActiveNick(activeServer).toLowerCase() : "";
  const isOurNick = !!ourNickLower && nickname.toLowerCase() === ourNickLower;
  const isAway = activeServer
    ? !!awayUsersMap[activeServer.id]?.[nickname.toLowerCase()] ||
      (isOurNick && !!selfAwayMap[activeServer.id])
    : false;
  const rawAwayReason = activeServer
    ? (isOurNick ? selfAwayReasonsMap?.[activeServer.id] : undefined) ||
      awayReasonsMap[activeServer.id]?.[nickname.toLowerCase()]
    : undefined;
  // "Away" is the generic default sent when no reason was given; it adds nothing to show.
  const awayReason =
    rawAwayReason && rawAwayReason.trim().toLowerCase() !== "away"
      ? translateAwayReason(rawAwayReason)
      : undefined;

  const userModes = activeChannel ? channelUserModesMap[activeChannel.id]?.[nickname.toLowerCase()] || [] : [];
  const highestRole = getHighestChannelRole(userModes);

  const displayName = getMemberDisplayName(freshMember, activeServer);
  const isSelf =
    freshMember.profileId === currentProfile.id ||
    (activeServer?.nicknames?.[0] &&
      freshMember.profile.name.toLowerCase() === activeServer.nicknames[0].toLowerCase());

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
                {isSelf ? t("ctx.messageYourself") : t("hover.message")}
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
              <div className="flex justify-between items-center text-yellow-600 dark:text-yellow-400 font-semibold">
                <span>{t("hover.status")}</span>
                <span className="truncate max-w-[160px]">{awayReason ? `${t("ctx.away")}: ${awayReason}` : t("ctx.away")}</span>
              </div>
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

