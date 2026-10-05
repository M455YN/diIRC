import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Server, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobileShell } from "@/hooks/use-mobile-platform";
import { useMockStore } from "@/lib/mock-store";
import { useModal } from "@/hooks/use-modal-store";
import { cn } from "@/lib/utils";

export const SetupPage = () => {
  const servers = useMockStore((state) => state.servers);
  const navigate = useNavigate();
  const { onOpen } = useModal();
  const isMobile = useIsMobileShell();

  useEffect(() => {
    if (servers.length > 0) {
      navigate(`/servers/${servers[0].id}`, { replace: true });
    }
  }, [servers, navigate]);

  if (servers.length > 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex h-full flex-1 flex-col items-center justify-center p-6 text-center",
        isMobile
          ? "bg-background text-foreground"
          : "bg-white text-zinc-900 dark:bg-[#313338] dark:text-zinc-100"
      )}
    >
      <div className="flex max-w-md flex-col items-center space-y-4">
        <div
          className={cn(
            "mb-2 flex h-16 w-16 items-center justify-center rounded-full",
            isMobile ? "bg-secondary" : "bg-zinc-200 dark:bg-zinc-700/50"
          )}
        >
          <Server
            className={cn(
              "h-8 w-8",
              isMobile ? "text-muted-foreground" : "text-zinc-500 dark:text-zinc-400"
            )}
          />
        </div>
        <h2 className="text-2xl font-bold">No servers added</h2>
        <p
          className={cn(
            "max-w-xs text-sm",
            isMobile ? "text-muted-foreground" : "text-zinc-500 dark:text-zinc-400"
          )}
        >
          You haven't added any IRC servers yet. Add a server to start chatting.
        </p>
        <Button
          onClick={() => onOpen("createServer")}
          className={cn(
            "flex items-center gap-x-2 px-5 py-2 font-medium text-white",
            isMobile
              ? "bg-blue-500 hover:bg-blue-600"
              : "bg-indigo-600 hover:bg-indigo-700"
          )}
        >
          <Plus className="h-4 w-4" />
          Add server
        </Button>
      </div>
    </div>
  );
};

