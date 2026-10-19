import { useTranslation } from "react-i18next";
import { 
  Gavel,
  Loader2,
  MoreVertical
} from "lucide-react";
import { useState } from "react";
import { Member, ServerWithMembersWithProfiles } from "@/types";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { UserAvatar } from "@/components/user-avatar";
import { UserHoverCard, getMemberDisplayName } from "@/components/user-hover-card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMockStore } from "@/lib/mock-store";

export const MembersModal = () => {
  const { t: tr } = useTranslation();
  const { onOpen, isOpen, onClose, type, data } = useModal();
  const [loadingId, setLoadingId] = useState("");
  const removeMember = useMockStore((state) => state.removeMember);
  const servers = useMockStore((state) => state.servers);

  const isModalOpen = isOpen && type === "members";
  const initialServer = data?.server as ServerWithMembersWithProfiles;
  const server = servers.find((s) => s.id === initialServer?.id) || initialServer;

  const onKick = async (memberId: string) => {
    try {
      setLoadingId(memberId);
      if (server?.id) {
        removeMember(server.id, memberId);
        const updated = servers.find((s) => s.id === server.id);
        if (updated) {
          onOpen("members", { server: updated });
        }
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingId("");
    }
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-xl overflow-hidden">
        <DialogHeader className="pt-6 px-6">
          <DialogTitle className="text-2xl text-center font-bold text-zinc-900 dark:text-zinc-100">
            {tr("rest.manageMembers")}
          </DialogTitle>
          <DialogDescription 
            className="text-center text-zinc-500 dark:text-zinc-400"
          >
            {server?.members?.length} members
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="mt-6 max-h-[420px] px-6">
          {server?.members?.map((member: Member) => {
            const displayName = getMemberDisplayName(member, server);
            return (
              <div key={member.id} className="flex items-center gap-x-2 mb-6">
                <UserHoverCard member={member} server={server} side="right">
                  <div className="flex items-center gap-x-2 cursor-pointer">
                    <UserAvatar src={member.profile.imageUrl} name={displayName} serverId={server?.id} nick={member.profile.name} />
                    <div className="flex flex-col gap-y-0.5">
                      <div className="text-xs font-semibold flex items-center gap-x-1 hover:underline">
                        {displayName}
                      </div>
                      <p className="text-xs text-zinc-500">
                        @{member.profile.name}
                      </p>
                    </div>
                  </div>
                </UserHoverCard>
              {server.profileId !== member.profileId && loadingId !== member.id && (
                <div className="ml-auto">
                  <DropdownMenu>
                    <DropdownMenuTrigger>
                      <MoreVertical className="h-4 w-4 text-zinc-500" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="left">

                      <DropdownMenuItem
                        onClick={() => onKick(member.id)}
                      >
                        <Gavel className="h-4 w-4 mr-2" />
                        Kick
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
              {loadingId === member.id && (
                <Loader2
                  className="animate-spin text-zinc-500 ml-auto w-4 h-4"
                />
              )}
            </div>
          );
        })}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
