import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMockStore } from "@/lib/mock-store";
import { useModal } from "@/hooks/use-modal-store";
import { useIsMobileShell } from "@/hooks/use-mobile-platform";
import { Hash, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export const ServerPage = () => {
  const { serverId } = useParams();
  const navigate = useNavigate();
  const isMobile = useIsMobileShell();
  const servers = useMockStore((state) => state.servers);
  const lastActiveChatPerServer = useMockStore((state) => state.lastActiveChatPerServer);
  const { onOpen } = useModal();

  const server = servers.find((s) => s.id === serverId);

  useEffect(() => {
    // Mobile shell shows the channel list at /servers/:id — do not auto-enter last chat.
    if (isMobile) {
      if (!server && servers.length > 0) {
        navigate(`/servers/${servers[0].id}`, { replace: true });
      } else if (!server && servers.length === 0) {
        navigate("/", { replace: true });
      }
      return;
    }

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
  }, [serverId, servers, server, lastActiveChatPerServer, navigate, isMobile]);

  if (server && server.channels.length === 0) {
    return (
      <div
        className={
          isMobile
            ? "flex h-full flex-1 flex-col items-center justify-center bg-background p-6 text-center text-foreground"
            : "flex h-full flex-1 flex-col items-center justify-center bg-white p-6 text-center dark:bg-[#313338]"
        }
      >
        <div className="flex max-w-md flex-col items-center space-y-4">
          <div
            className={
              isMobile
                ? "mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-secondary"
                : "mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-200 dark:bg-zinc-700/50"
            }
          >
            <Hash
              className={
                isMobile
                  ? "h-8 w-8 text-muted-foreground"
                  : "h-8 w-8 text-zinc-500 dark:text-zinc-400"
              }
            />
          </div>
          <h2
            className={
              isMobile
                ? "text-2xl font-bold"
                : "text-2xl font-bold text-zinc-900 dark:text-zinc-100"
            }
          >
            No channels on server
          </h2>
          <p
            className={
              isMobile
                ? "max-w-xs text-sm text-muted-foreground"
                : "max-w-xs text-sm text-zinc-500 dark:text-zinc-400"
            }
          >
            This server currently has no channels. Join an existing channel or create a new one.
          </p>
          <Button
            onClick={() => onOpen("createChannel", { server })}
            className={
              isMobile
                ? "flex items-center gap-x-2 bg-blue-500 px-5 py-2 font-medium text-white hover:bg-blue-600"
                : "flex items-center gap-x-2 bg-indigo-600 px-5 py-2 font-medium text-white hover:bg-indigo-700"
            }
          >
            <Plus className="h-4 w-4" />
            Join / Create channel
          </Button>
        </div>
      </div>
    );
  }

  // On mobile, channel list is rendered by MobileShellLayout via ServerSidebar.
  if (isMobile) {
    return null;
  }

  return null;
};
