import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useMockStore } from "@/lib/mock-store";
import { ChatHeader } from "@/components/chat/chat-header";
import { Button } from "@/components/ui/button";
import { Hash, Check, X, Sparkles } from "lucide-react";

export const InvitePreviewPage = () => {
  const { t: tr } = useTranslation();
  const { serverId, channelName } = useParams();
  const navigate = useNavigate();
  const servers = useMockStore((state) => state.servers);
  const pendingInvites = useMockStore((state) => state.pendingInvites);
  const acceptPendingInvite = useMockStore((state) => state.acceptPendingInvite);
  const ignorePendingInvite = useMockStore((state) => state.ignorePendingInvite);

  const server = servers.find((s) => s.id === serverId) || servers[0];
  const cleanChan = channelName ? decodeURIComponent(channelName).replace(/^#/, "") : "";
  const serverInvites = (server ? pendingInvites[server.id] : []) || [];
  const invite = serverInvites.find(
    (i) => i.channelName.toLowerCase() === cleanChan.toLowerCase()
  );

  const handleJoin = async () => {
    if (!server || !cleanChan) return;
    await acceptPendingInvite(server.id, cleanChan);
    // After joining, navigate to the newly joined channel if present
    const chanObj = server.channels.find(
      (c) => c.name.toLowerCase().replace(/^#/, "") === cleanChan.toLowerCase()
    );
    if (chanObj) {
      navigate(`/servers/${server.id}/channels/${chanObj.id}`, { replace: true });
    } else {
      navigate(`/servers/${server.id}`, { replace: true });
    }
  };

  const handleIgnore = () => {
    if (!server || !cleanChan) return;
    ignorePendingInvite(server.id, cleanChan);
    navigate(`/servers/${server.id}`, { replace: true });
  };

  if (!server) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-[#313338] flex flex-col h-full">
      <ChatHeader
        name={cleanChan || "Invite"}
        serverId={server.id}
        type="channel"
        server={server}
      />

      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="max-w-md w-full bg-zinc-50 dark:bg-[#2B2D31] border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-2xl flex flex-col items-center space-y-6">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
              <Hash className="w-10 h-10 text-indigo-500" />
            </div>
            <div className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-1.5 shadow-md">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {tr("rest.invitedTitle")}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
              <span className="font-semibold text-zinc-700 dark:text-zinc-200">
                {invite?.inviter || "Someone"}
              </span>{" "}
              invited you to join{" "}
              <span className="font-semibold text-indigo-500 dark:text-indigo-400">
                #{cleanChan}
              </span>{" "}
              on <span className="font-medium">{server.name}</span>.
            </p>
          </div>

          <div className="flex items-center gap-x-3 w-full pt-2">
            <Button
              onClick={handleIgnore}
              variant="outline"
              className="flex-1 border-zinc-300 dark:border-zinc-700 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/30 gap-x-2 text-xs font-semibold py-5"
            >
              <X className="w-4 h-4" />
              {tr("rest.ignoreInvite")}
            </Button>

            <Button
              onClick={handleJoin}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white gap-x-2 text-xs font-semibold py-5 shadow-md"
            >
              <Check className="w-4 h-4" />
              {tr("rest.joinChannel")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
