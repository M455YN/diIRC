import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useMockStore, getServerSelfMember } from "@/lib/mock-store";
import { useUIStore } from "@/hooks/use-ui-store";
import { useSearchStore } from "@/hooks/use-search-store";
import { useIsMobileShell } from "@/hooks/use-mobile-platform";
import { useMobileBackHandler } from "@/hooks/use-mobile-back-handler";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatMembersSidebar } from "@/components/chat/chat-members-sidebar";
import { ChatSearchResultsPanel } from "@/components/chat/search/search-results-panel";
import { getMemberDisplayName } from "@/components/user-hover-card";
import { MobileChatHeader } from "@/components/mobile/mobile-chat-header";
import { MobileMembersSheet } from "@/components/mobile/mobile-members-sheet";
import { MobileMessageSearch } from "@/components/mobile/mobile-message-search";

export const ConversationPage = () => {
  const { serverId, memberId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
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
  const targetMember =
    server?.members.find((m) => m.id === memberId) ||
    server?.members.find((m) => m.profile.name.toLowerCase() === memberId?.toLowerCase());
  const setLastActiveChat = useMockStore((state) => state.setLastActiveChat);

  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (serverId && memberId && targetMember) {
      useMockStore.getState().openConversation(serverId, targetMember.id);
      setLastActiveChat(serverId, { type: "conversation", id: targetMember.id });

      if (!isMobile) {
        const wasInConversation = prevPathRef.current?.includes("/conversations/");
        if (!wasInConversation) {
          setMembersSidebar(false);
        }
      }
    }
    prevPathRef.current = location.pathname;
  }, [
    serverId,
    memberId,
    targetMember,
    location.pathname,
    setMembersSidebar,
    setLastActiveChat,
    isMobile,
  ]);

  useEffect(() => {
    if (!server && servers.length > 0) {
      navigate(`/servers/${servers[0].id}`, { replace: true });
    }
  }, [server, servers, navigate]);

  if (!server || !targetMember) {
    return null;
  }

  const currentMember = getServerSelfMember(server, currentProfile.id);
  const conversationId = [currentMember.id, targetMember.id].sort().join("-");
  const displayName = getMemberDisplayName(targetMember, server);
  const targetNick = targetMember.profile.name;
  const isAway = useMockStore(
    (state) => !!state.awayUsers[server.id]?.[targetNick.toLowerCase()]
  );

  const searchContext = {
    type: "conversation" as const,
    chatId: conversationId,
    serverId: server.id,
    target: targetNick,
  };

  const searchMembers = server.members.flatMap((m) =>
    m.profile?.name ? [{ name: m.profile.name, realname: m.profile?.realname }] : []
  );

  if (isMobile) {
    return (
      <div className="flex h-full flex-col bg-background text-foreground">
        <MobileChatHeader
          name={displayName}
          type="conversation"
          imageUrl={targetMember.profile.imageUrl}
          online={!isAway}
          statusLabel={isAway ? "Away" : "Online"}
          onBack={() => navigate(`/servers/${server.id}`)}
          onMembers={() => setMembersOpen(true)}
          onSearch={() => {
            setSearchSheetOpen(true);
            openSearch();
          }}
          showMembers={membersOpen}
        />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ChatMessages
            member={currentMember}
            name={targetNick}
            chatId={conversationId}
            serverId={server.id}
            type="conversation"
            paramKey="conversationId"
            paramValue={conversationId}
          />
          <div className="mobile-safe-bottom shrink-0 bg-background">
            <ChatInput
              name={targetNick}
              type="conversation"
              query={{
                conversationId,
                serverId: server.id,
                targetMemberId: targetMember.id,
              }}
            />
          </div>
        </div>

        <MobileMembersSheet
          open={membersOpen}
          onOpenChange={setMembersOpen}
          server={server}
        />

        <MobileMessageSearch
          open={searchSheetOpen}
          onClose={() => {
            setSearchSheetOpen(false);
            closeSearch();
          }}
          context={searchContext}
          members={searchMembers}
        />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#313338] flex flex-col h-full">
      <ChatHeader
        imageUrl={targetMember.profile.imageUrl}
        name={displayName}
        serverId={server.id}
        type="conversation"
        targetMember={targetMember}
        server={server}
        searchContext={searchContext}
        searchMembers={searchMembers}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-col flex-1 h-full min-w-0">
          <ChatMessages
            member={currentMember}
            name={targetNick}
            chatId={conversationId}
            serverId={server.id}
            type="conversation"
            paramKey="conversationId"
            paramValue={conversationId}
          />
          <ChatInput
            name={targetNick}
            type="conversation"
            query={{
              conversationId,
              serverId: server.id,
              targetMemberId: targetMember.id,
            }}
          />
        </div>
        {searchOpen ? (
          <ChatSearchResultsPanel context={searchContext} />
        ) : (
          showMembersSidebar && <ChatMembersSidebar server={server} />
        )}
      </div>
    </div>
  );
};
