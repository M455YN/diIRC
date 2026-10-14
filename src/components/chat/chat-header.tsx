import { Hash, PanelLeft, Server, Users, Edit3, History, Bookmark, StickyNote } from "lucide-react";
import { useTranslation } from "react-i18next";

import { MobileToggle } from "@/components/mobile-toggle";
import { UserAvatar } from "@/components/user-avatar";
import { UserHoverCard } from "@/components/user-hover-card";
import { ActionTooltip } from "@/components/action-tooltip";
import { ChatSearchInput } from "@/components/chat/search/chat-search-input";
import { useMockStore } from "@/lib/mock-store";
import { useUIStore } from "@/hooks/use-ui-store";
import { useModal } from "@/hooks/use-modal-store";
import { useChangelog } from "@/lib/changelog-service";
import { cn } from "@/lib/utils";
import { Channel, Member, Profile, Server as ServerType } from "@/types";

import { ConnectionStatus } from "@/components/connection-status";

interface ChatHeaderProps {
  serverId: string;
  name: string;
  type: "channel" | "conversation";
  imageUrl?: string;
  channel?: Channel;
  server?: ServerType;
  targetMember?: Member & { profile: Profile };
  /** Context for the Discord-style message search; omit to hide the search box. */
  searchContext?: {
    type: "channel" | "conversation";
    chatId: string;
    serverId: string;
    target: string;
  };
  /** Member nicknames for the search input's from:/mentions: autocompletion. */
  searchMembers?: { name: string; realname?: string }[];
}

const KNOWN_MODE_KEYS: Record<string, string> = {
  n: "chat.modes.n",
  t: "chat.modes.t",
  m: "chat.modes.m",
  i: "chat.modes.i",
  s: "chat.modes.s",
  p: "chat.modes.p",
  k: "chat.modes.k",
  l: "chat.modes.l",
  r: "chat.modes.r",
};

export const ChatHeader = ({
  serverId,
  name,
  type,
  imageUrl,
  channel,
  server,
  targetMember,
  searchContext,
  searchMembers,
}: ChatHeaderProps) => {
  const { t: tr } = useTranslation();
  const { 
    showNavigationSidebar, 
    toggleNavigationSidebar, 
    showServerSidebar, 
    toggleServerSidebar, 
    showMembersSidebar, 
    toggleMembersSidebar 
  } = useUIStore();

  const { onOpen } = useModal();
  const { hasCurrentVersion } = useChangelog();

  const isServerConnected = useMockStore((state) => !!(server?.id && state.ircConnectedServers[server.id]));
  const channelModeFlags = useMockStore((state) => (channel?.id ? state.channelModes[channel.id] : undefined));

  // Hover text for the channel name: the modes the server reported for this channel.
  const modesTooltip = (() => {
    if (channelModeFlags === undefined) return tr("chat.modes.unknown");
    if (channelModeFlags.length === 0) return tr("chat.modes.none");
    const letters = [...channelModeFlags].sort().join("");
    const described = channelModeFlags
      .slice()
      .sort()
      .map((f) => (KNOWN_MODE_KEYS[f] ? tr(KNOWN_MODE_KEYS[f]) : f))
      .join(", ");
    return `+${letters}: ${described}`;
  })();

  const handleEditTopic = () => {
    if (server && channel && isServerConnected) {
      onOpen("editTopic", { server, channel });
    }
  };

  const renderConversationHeader = () => {
    const avatarAndName = (
      <div className="flex items-center gap-x-2 cursor-pointer">
        <UserAvatar 
          src={imageUrl}
          name={name}
          className="h-8 w-8 md:h-8 md:w-8 shrink-0"
        />
        <p className="font-semibold text-md text-black dark:text-white shrink-0 hover:underline">
          {name}
        </p>
      </div>
    );

    if (targetMember && server) {
      return (
        <UserHoverCard member={targetMember} server={server} side="bottom">
          {avatarAndName}
        </UserHoverCard>
      );
    }

    return avatarAndName;
  };

  return (
    <div className="text-md font-semibold px-3 flex items-center h-12 border-neutral-200 dark:border-neutral-800 border-b-2 gap-x-2 min-w-0 relative z-20 bg-white dark:bg-[#313338]">
      <MobileToggle serverId={serverId} />
      
      <ActionTooltip 
        side="bottom" 
        label={showNavigationSidebar ? tr("chat.header.hideServerList") : tr("chat.header.showServerList")}
      >
        <button
          onClick={toggleNavigationSidebar}
          className="hidden md:flex items-center justify-center p-1.5 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50 transition shrink-0"
        >
          <Server className={cn(
            "w-5 h-5 text-zinc-500 dark:text-zinc-400 transition",
            showNavigationSidebar && "text-indigo-500 dark:text-indigo-400"
          )} />
        </button>
      </ActionTooltip>

      <ActionTooltip 
        side="bottom" 
        label={showServerSidebar ? tr("chat.header.hideChannelList") : tr("chat.header.showChannelList")}
      >
        <button
          onClick={toggleServerSidebar}
          className="hidden md:flex items-center justify-center p-1.5 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50 transition mr-1 shrink-0"
        >
          <PanelLeft className={cn(
            "w-5 h-5 text-zinc-500 dark:text-zinc-400 transition",
            showServerSidebar && "text-indigo-500 dark:text-indigo-400"
          )} />
        </button>
      </ActionTooltip>

      {type === "channel" && (
        <>
          <Hash className="w-5 h-5 text-zinc-500 dark:text-zinc-400 shrink-0" />
          <ActionTooltip side="bottom" label={modesTooltip}>
            <p className="font-semibold text-md text-black dark:text-white shrink-0 cursor-default">
              {name}
            </p>
          </ActionTooltip>
        </>
      )}

      {type === "conversation" && renderConversationHeader()}

      {type === "channel" && channel && (
        <div className="hidden sm:flex items-center min-w-0 flex-1 overflow-hidden ml-2">
          <div className="h-4 w-[1px] bg-zinc-300 dark:bg-zinc-700 mx-2 shrink-0" />
          <div className="flex items-center gap-x-1.5 truncate max-w-full group">
            {channel.topic ? (
              <ActionTooltip side="bottom" label={channel.topic}>
                <span 
                  onClick={handleEditTopic}
                  className="text-xs text-zinc-500 dark:text-zinc-400 font-normal truncate cursor-pointer hover:text-zinc-700 dark:hover:text-zinc-200 transition"
                >
                  {channel.topic}
                </span>
              </ActionTooltip>
            ) : (
              <span 
                onClick={handleEditTopic}
                className="text-xs text-zinc-400 dark:text-zinc-500 font-normal italic cursor-pointer hover:text-zinc-600 dark:hover:text-zinc-300 transition"
              >
                {tr("chat.header.noTopic")}
              </span>
            )}
            
            <ActionTooltip side="bottom" label={tr("chat.header.editTopic")}>
              <button
                onClick={handleEditTopic}
                disabled={!isServerConnected}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50 transition text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 shrink-0"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </ActionTooltip>
          </div>
        </div>
      )}

      <div className="ml-auto flex items-center gap-x-3 shrink-0">
        <ActionTooltip side="bottom" label={tr("notes.title")}>
          <button
            onClick={() => onOpen("notes")}
            aria-label={tr("notes.title")}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 transition"
          >
            <StickyNote className="w-4 h-4" />
          </button>
        </ActionTooltip>
        <ActionTooltip side="bottom" label={tr("chat.header.bookmarks")}>
          <button
            onClick={() => onOpen("bookmarks")}
            aria-label={tr("chat.header.bookmarks")}
            className="h-7 w-7 rounded-lg flex items-center justify-center text-zinc-500 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800 transition"
          >
            <Bookmark className="w-4 h-4" />
          </button>
        </ActionTooltip>
        <ActionTooltip side="bottom" label={tr("chat.header.changelog")}>
          <button
            onClick={() => onOpen("changelog")}
            className={cn(
              "h-7 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-x-1.5 transition shadow-sm",
              hasCurrentVersion
                ? "bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500"
                : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-300 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-zinc-700/60"
            )}
          >
            <History className="w-3.5 h-3.5" />
            <span>{tr("chat.header.changelog")}</span>
          </button>
        </ActionTooltip>

        <ConnectionStatus serverId={serverId} server={server} />

        {searchContext && (
          <ChatSearchInput context={searchContext} members={searchMembers} />
        )}

        <ActionTooltip
          side="bottom" 
          label={showMembersSidebar ? tr("chat.header.hideUserList") : tr("chat.header.showUserList")}
        >
          <button
            onClick={toggleMembersSidebar}
            className="flex items-center justify-center p-1.5 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50 transition"
          >
            <Users className={cn(
              "w-5 h-5 text-zinc-500 dark:text-zinc-400 transition",
              showMembersSidebar && "text-indigo-500 dark:text-indigo-400"
            )} />
          </button>
        </ActionTooltip>
      </div>
    </div>
  );
};
