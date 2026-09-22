import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMockStore } from "@/lib/mock-store";
import { useModal } from "@/hooks/use-modal-store";
import { ChannelType } from "@/types";
import { Hash, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ServerPage = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const servers = useMockStore((state) => state.servers);
  const lastActiveChatPerServer = useMockStore((state) => state.lastActiveChatPerServer);
  const { onOpen } = useModal();

  const server = servers.find((s) => s.id === serverId);

  useEffect(() => {
    if (server) {
      const lastActive = serverId ? lastActiveChatPerServer[serverId] : undefined;

      if (lastActive) {
        if (lastActive.type === "channel" && server.channels.some((c) => c.id === lastActive.id)) {
          navigate(`/servers/${server.id}/channels/${lastActive.id}`, { replace: true });
          return;
        }
        if (lastActive.type === "conversation" && server.members.some((m) => m.id === lastActive.id)) {
          navigate(`/servers/${server.id}/conversations/${lastActive.id}`, { replace: true });
          return;
        }
      }

      const initialChannel = server.channels[0];

      if (initialChannel) {
        navigate(`/servers/${server.id}/channels/${initialChannel.id}`, { replace: true });
      }
    } else if (servers.length > 0) {
      navigate(`/servers/${servers[0].id}`, { replace: true });
    } else {
      navigate("/", { replace: true });
    }
  }, [serverId, servers, server, lastActiveChatPerServer, navigate]);

  if (server && server.channels.length === 0) {
    return (
      <div className="flex-1 bg-white dark:bg-[#313338] flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="flex flex-col items-center max-w-md space-y-4">
          <div className="w-16 h-16 rounded-full bg-zinc-200 dark:bg-zinc-700/50 flex items-center justify-center mb-2">
            <Hash className="w-8 h-8 text-zinc-500 dark:text-zinc-400" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            No channels on server
          </h2>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm max-w-xs">
            This server currently has no channels. Join an existing channel or create a new one.
          </p>
          <Button
            onClick={() => onOpen("createChannel", { server })}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-5 py-2 flex items-center gap-x-2"
          >
            <Plus className="w-4 h-4" />
            Join / Create channel
          </Button>
        </div>
      </div>
    );
  }

  return null;
};
