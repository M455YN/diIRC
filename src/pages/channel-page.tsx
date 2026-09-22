import { useParams, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useMockStore } from "@/lib/mock-store";
import { useUIStore } from "@/hooks/use-ui-store";
import { useSearchStore } from "@/hooks/use-search-store";
import { ChatHeader } from "@/components/chat/chat-header";
import { ChatInput } from "@/components/chat/chat-input";
import { ChatMessages } from "@/components/chat/chat-messages";
import { ChatMembersSidebar } from "@/components/chat/chat-members-sidebar";
import { ChatSearchResultsPanel } from "@/components/chat/search/search-results-panel";

export const ChannelPage = () => {
  const { serverId, channelId } = useParams();
  const navigate = useNavigate();
  const servers = useMockStore((state) => state.servers);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const showMembersSidebar = useUIStore((state) => state.showMembersSidebar);
  const setMembersSidebar = useUIStore((state) => state.setMembersSidebar);
  const searchOpen = useSearchStore((state) => state.open);

  const server = servers.find((s) => s.id === serverId);
  const channel = server?.channels.find((c) => c.id === channelId);
  const setLastActiveChat = useMockStore((state) => state.setLastActiveChat);

  useEffect(() => {
    if (serverId && channel?.id) {
      setLastActiveChat(serverId, { type: "channel", id: channel.id });
    }
  }, [serverId, channel?.id, setLastActiveChat]);

  useEffect(() => {
    if (channelId) {
      setMembersSidebar(true);
    }
  }, [channelId, setMembersSidebar]);

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

  return (
    <div className="bg-white dark:bg-[#313338] flex flex-col h-full">
      <ChatHeader
        name={channel.name}
        serverId={server.id}
        type="channel"
        channel={channel}
        server={server}
        searchContext={{
          type: "channel",
          chatId: channel.id,
          serverId: server.id,
          target: channel.name.startsWith("#") ? channel.name : `#${channel.name}`,
        }}
        searchMembers={server.members.flatMap((m) =>
          m.profile?.name ? [{ name: m.profile.name, realname: m.profile?.realname }] : []
        )}
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
          <ChatSearchResultsPanel
            context={{
              type: "channel",
              chatId: channel.id,
              serverId: server.id,
              target: channel.name.startsWith("#") ? channel.name : `#${channel.name}`,
            }}
          />
        ) : (
          showMembersSidebar && <ChatMembersSidebar server={server} channel={channel} />
        )}
      </div>
    </div>
  );
};
