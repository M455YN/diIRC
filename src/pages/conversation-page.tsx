import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import { useMockStore, getServerSelfMember } from "@/lib/mock-store";
import { useUIStore } from "@/hooks/use-ui-store";
import { useSearchStore } from "@/hooks/use-search-store";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatMembersSidebar } from "@/components/chat/chat-members-sidebar";
import { ChatSearchResultsPanel } from "@/components/chat/search/search-results-panel";
import { getMemberDisplayName } from "@/components/user-hover-card";

export const ConversationPage = () => {
  const { serverId, memberId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const servers = useMockStore((state) => state.servers);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const showMembersSidebar = useUIStore((state) => state.showMembersSidebar);
  const setMembersSidebar = useUIStore((state) => state.setMembersSidebar);
  const searchOpen = useSearchStore((state) => state.open);

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
      
      const wasInConversation = prevPathRef.current?.includes("/conversations/");
      if (!wasInConversation) {
        setMembersSidebar(false);
      }
    }
    prevPathRef.current = location.pathname;
  }, [serverId, memberId, targetMember, location.pathname, setMembersSidebar, setLastActiveChat]);

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

  return (
    <div className="bg-white dark:bg-[#313338] flex flex-col h-full">
      <ChatHeader
        imageUrl={targetMember.profile.imageUrl}
        name={displayName}
        serverId={server.id}
        type="conversation"
        targetMember={targetMember}
        server={server}
        searchContext={{
          type: "conversation",
          chatId: conversationId,
          serverId: server.id,
          target: targetNick,
        }}
        searchMembers={server.members.flatMap((m) =>
          m.profile?.name ? [{ name: m.profile.name, realname: m.profile?.realname }] : []
        )}
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
          <ChatSearchResultsPanel
            context={{
              type: "conversation",
              chatId: conversationId,
              serverId: server.id,
              target: targetNick,
            }}
          />
        ) : (
          showMembersSidebar && <ChatMembersSidebar server={server} />
        )}
      </div>
    </div>
  );
};
