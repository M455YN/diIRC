import { Channel, Server } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ChatMembersSidebar } from "@/components/chat/chat-members-sidebar";

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
}: MobileMembersSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-full p-0 flex flex-col bg-[#F2F3F5] dark:bg-[#2B2D31]"
      >
        <SheetHeader className="mobile-safe-top px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <SheetTitle className="text-left text-base">
            {channel ? "Users" : "Conversations"}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-hidden">
          <ChatMembersSidebar server={server} channel={channel} variant="panel" />
        </div>
      </SheetContent>
    </Sheet>
  );
};
