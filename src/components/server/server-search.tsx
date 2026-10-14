import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useMockStore } from "@/lib/mock-store";

import { 
  CommandDialog, 
  CommandEmpty, 
  CommandGroup, 
  CommandInput,
  CommandItem,
  CommandList
} from "@/components/ui/command";

interface ServerSearchProps {
  serverId?: string;
  data: {
    label: string;
    type: "channel" | "member";
    data: {
      icon: React.ReactNode;
      name: string;
      id: string;
    }[] | undefined;
  }[];
}

export const ServerSearch = ({
  serverId,
  data
}: ServerSearchProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  // The shortcut is Cmd+K on macOS and Ctrl+K elsewhere; show the one that applies here.
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const params = useParams();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const onClick = ({ id, type }: { id: string; type: "channel" | "member" }) => {
    setOpen(false);

    const targetServerId = serverId || params?.serverId;
    if (!targetServerId) return;

    if (type === "member") {
      useMockStore.getState().openConversation(targetServerId, id);
      return navigate(`/servers/${targetServerId}/conversations/${id}`);
    }

    if (type === "channel") {
      return navigate(`/servers/${targetServerId}/channels/${id}`);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group px-2 py-2 rounded-md flex items-center gap-x-2 w-full hover:bg-zinc-700/10 dark:hover:bg-zinc-700/50 transition"
      >
        <Search className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
        <p
          className="font-semibold text-sm text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition"
        >
          {t("srv.search")}
        </p>
        <kbd
          className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground ml-auto"
        >
          {isMac ? (
            <>
              <span className="text-xs">⌘</span>K
            </>
          ) : (
            "Ctrl K"
          )}
        </kbd>
      </button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={t("srv.searchAll")} />
        <CommandList>
          <CommandEmpty>
            {t("srv.noResults")}
          </CommandEmpty>
          {data.map(({ label, type, data: items }) => {
            if (!items?.length) return null;

            return (
              <CommandGroup key={label} heading={label}>
                {items?.map(({ id, icon, name }) => {
                  return (
                    <CommandItem key={id} onSelect={() => onClick({ id, type })}>
                      {icon}
                      <span>{name}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            );
          })}
        </CommandList>
      </CommandDialog>
    </>
  );
};
