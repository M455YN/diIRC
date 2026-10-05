import { Channel, Server } from "@/types";
import { ChatMembersSidebar } from "@/components/chat/chat-members-sidebar";
import { M3FullScreenDialog } from "@/components/mobile/m3";

interface MobileMembersSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  server: Server;
  channel?: Channel;
}

export const MobileMembersSheet = ({
  open,
  onOpenChange,
  server,
  channel,
}: MobileMembersSheetProps) => (
  <M3FullScreenDialog
    open={open}
    title={channel ? `Users in #${channel.name.replace(/^#/, "")}` : "Conversations"}
    leading="back"
    onClose={() => onOpenChange(false)}
  >
    <ChatMembersSidebar server={server} channel={channel} variant="panel" />
  </M3FullScreenDialog>
);
