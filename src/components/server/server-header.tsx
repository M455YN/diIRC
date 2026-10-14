import { useTranslation } from "react-i18next";
import { ServerWithMembersWithProfiles } from "@/types";
import { 
  ChevronDown, 
  PlusCircle, 
  Settings, 
  Trash,
  Unplug,
  Radio,
} from "lucide-react";

import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { useModal } from "@/hooks/use-modal-store";
import { useMockStore } from "@/lib/mock-store";

interface ServerHeaderProps {
  server: ServerWithMembersWithProfiles;
}

export const ServerHeader = ({
  server
}: ServerHeaderProps) => {
  const { t } = useTranslation();
  const { onOpen } = useModal();
  const isIrcConnected = useMockStore((state) => !!state.ircConnectedServers[server.id]);
  const connectServer = useMockStore((state) => state.connectServer);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="focus:outline-none" 
        asChild
      >
        <button
          className="w-full text-md font-semibold px-3 flex items-center h-12 border-neutral-200 dark:border-neutral-800 border-b-2 hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 transition"
        >
          {server.name}
          <ChevronDown className="h-5 w-5 ml-auto" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-56 text-xs font-medium text-black dark:text-neutral-400 space-y-[2px]"
      >
        <DropdownMenuItem
          onSelect={() => setTimeout(() => onOpen("editServer", { server }), 0)}
          className="px-3 py-2 text-sm cursor-pointer"
        >
          {t("srv.serverSettings")}
          <Settings className="h-4 w-4 ml-auto" />
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => setTimeout(() => onOpen("createChannel", { server }), 0)}
          className="px-3 py-2 text-sm cursor-pointer"
        >
          {t("srv.joinChannel")}
          <PlusCircle className="h-4 w-4 ml-auto" />
        </DropdownMenuItem>
        {isIrcConnected ? (
          <DropdownMenuItem
            onSelect={() => setTimeout(() => onOpen("leaveServer", { server }), 0)}
            className="px-3 py-2 text-sm cursor-pointer text-amber-600 dark:text-amber-400"
          >
            {t("srv.disconnect")}
            <Unplug className="h-4 w-4 ml-auto" />
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem
            onSelect={() => connectServer(server.id)}
            className="px-3 py-2 text-sm cursor-pointer text-emerald-600 dark:text-emerald-400 font-semibold"
          >
            {t("srv.connect")}
            <Radio className="h-4 w-4 ml-auto" />
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => setTimeout(() => onOpen("deleteServer", { server }), 0)}
          className="text-rose-500 px-3 py-2 text-sm cursor-pointer"
        >
          {t("srv.removeServer")}
          <Trash className="h-4 w-4 ml-auto" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
