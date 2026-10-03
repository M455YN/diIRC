import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useMockStore } from "@/lib/mock-store";
import { useUIStore } from "@/hooks/use-ui-store";
import { useSearchStore } from "@/hooks/use-search-store";
import { useIsMobileShell } from "@/hooks/use-mobile-platform";
import { useMobileBackHandler } from "@/hooks/use-mobile-back-handler";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatMembersSidebar } from "@/components/chat/chat-members-sidebar";
import { ChatSearchResultsPanel } from "@/components/chat/search/search-results-panel";
import { MobileChatHeader } from "@/components/mobile/mobile-chat-header";
import { MobileMembersSheet } from "@/components/mobile/mobile-members-sheet";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChatSearchInput } from "@/components/chat/search/chat-search-input";

export const ChannelPage = () => {
  const { serverId, channelId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobileShell();
  const servers = useMockStore((state) => state.servers);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const showMembersSidebar = useUIStore((state) => state.showMembersSidebar);
  const setMembersSidebar = useUIStore((state) => state.setMembersSidebar);
  const searchOpen = useSearchStore((state) => state.open);
  const openSearch = useSearchStore((state) => state.openSearch);
  const closeSearch = useSearchStore((state) => state.closeSearch);

  const [membersOpen, setMembersOpen] = useState(false);
  const [searchSheetOpen, setSearchSheetOpen] = useState(false);

  useMobileBackHandler(searchSheetOpen, () => {
    setSearchSheetOpen(false);
    closeSearch();
  });
  useMobileBackHandler(membersOpen && !searchSheetOpen, () => setMembersOpen(false));

  const server = servers.find((s) => s.id === serverId);
  const channel = server?.channels.find((c) => c.id === channelId);
  const setLastActiveChat = useMockStore((state) => state.setLastActiveChat);

  useEffect(() => {
    if (serverId && channel?.id) {
      setLastActiveChat(serverId, { type: "channel", id: channel.id });
    }
  }, [serverId, channel?.id, setLastActiveChat]);

  useEffect(() => {
    if (channelId && !isMobile) {
      setMembersSidebar(true);
    }
  }, [channelId, setMembersSidebar, isMobile]);

  useEffect(() => {
    if (!server && servers.length > 0) {
      navigate(`/servers/${servers[0].id}`, { replace: true });
    } else if (server && !channel) {
      navigate(`/servers/${server.id}`, { replace: true });
    }
  }, [server, channel, servers, navigate]);

  if (!server || !channel) {
    return null;
  }

  const currentMember = server.members.find((m) => m.profileId === currentProfile.id) || server.members[0];

  const searchContext = {
    type: "channel" as const,
    chatId: channel.id,
    serverId: server.id,
    target: channel.name.startsWith("#") ? channel.name : `#${channel.name}`,
  };

  const searchMembers = server.members.flatMap((m) =>
    m.profile?.name ? [{ name: m.profile.name, realname: m.profile?.realname }] : []
  );

  if (isMobile) {
    return (
      <div className="bg-white dark:bg-[#313338] flex flex-col h-full">
        <MobileChatHeader
          name={channel.name}
          type="channel"
          onBack={() => navigate(`/servers/${server.id}`)}
          onMembers={() => setMembersOpen(true)}
          onSearch={() => {
            setSearchSheetOpen(true);
            openSearch();
          }}
          showMembers={membersOpen}
        />
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <ChatMessages
            member={currentMember}
            name={channel.name}
            chatId={channel.id}
            serverId={server.id}
            type="channel"
            paramKey="channelId"
            paramValue={channel.id}
          />
          <div className="mobile-safe-bottom shrink-0">
            <ChatInput
              name={channel.name}
              type="channel"
              query={{
                channelId: channel.id,
                serverId: channel.serverId,
              }}
            />
          </div>
        </div>

        <MobileMembersSheet
          open={membersOpen}
          onOpenChange={setMembersOpen}
          server={server}
          channel={channel}
        />

        <Sheet
          open={searchSheetOpen}
          onOpenChange={(open) => {
            setSearchSheetOpen(open);
            if (!open) closeSearch();
          }}
        >
          <SheetContent
            side="bottom"
            className="h-[85dvh] p-0 flex flex-col rounded-t-2xl"
          >
            <SheetHeader className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <SheetTitle className="text-left text-base">Search messages</SheetTitle>
            </SheetHeader>
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <ChatSearchInput context={searchContext} members={searchMembers} />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {searchOpen && (
                <ChatSearchResultsPanel context={searchContext} variant="panel" />
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#313338] flex flex-col h-full">
      <ChatHeader
        name={channel.name}
        serverId={server.id}
        type="channel"
        channel={channel}
        server={server}
        searchContext={searchContext}
        searchMembers={searchMembers}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 h-full min-w-0">
          <ChatMessages
            member={currentMember}
            name={channel.name}
            chatId={channel.id}
            serverId={server.id}
            type="channel"
            paramKey="channelId"
            paramValue={channel.id}
          />
          <ChatInput
            name={channel.name}
            type="channel"
            query={{
              channelId: channel.id,
              serverId: channel.serverId,
            }}
          />
        </div>
        {searchOpen ? (
          <ChatSearchResultsPanel context={searchContext} />
        ) : (
          showMembersSidebar && <ChatMembersSidebar server={server} channel={channel} />
        )}
      </div>
    </div>
  );
};
