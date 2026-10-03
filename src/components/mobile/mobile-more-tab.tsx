import { History, Settings, Wifi } from "lucide-react";
import { useParams } from "react-router-dom";
import { ModeToggle } from "@/components/mode-toggle";
import { useMockStore } from "@/lib/mock-store";
import { useModal } from "@/hooks/use-modal-store";
import { useChangelog } from "@/lib/changelog-service";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import { cn } from "@/lib/utils";

export const MobileMoreTab = () => {
  const { serverId } = useParams();
  const servers = useMockStore((state) => state.servers);
  const activeServer = servers.find((s) => s.id === serverId) || servers[0];
  const { onOpen } = useModal();
  const { hasCurrentVersion } = useChangelog();
  const { irc, resourceServer, internet } = useConnectionStatus(activeServer?.id);

  const rows = [
    {
      id: "settings",
      label: "Settings",
      description: "Notifications, appearance, and more",
      icon: Settings,
      onClick: () => onOpen("settings"),
    },
    {
      id: "connection",
      label: "Connection details",
      description: activeServer
        ? `${activeServer.name} · IRC ${irc ? "up" : "down"}`
        : "No server selected",
      icon: Wifi,
      onClick: () =>
        onOpen("connectionDetails", {
          serverId: activeServer?.id,
          server: activeServer,
        }),
      disabled: !activeServer,
    },
    {
      id: "changelog",
      label: "Changelog",
      description: hasCurrentVersion ? "What's new in this version" : "Release notes",
      icon: History,
      onClick: () => onOpen("changelog"),
    },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-[#313338]">
      <div className="mobile-safe-top flex items-center justify-between px-3 mobile-chrome-bar border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <h1 className="text-base font-bold text-zinc-900 dark:text-zinc-100">More</h1>
        <ModeToggle />
      </div>

      <div className="p-2 space-y-1.5">
        <div className="flex gap-1.5 px-0.5 pb-1">
          {[
            { label: "IRC", ok: irc },
            { label: "Resources", ok: resourceServer },
            { label: "Internet", ok: internet },
          ].map((s) => (
            <div
              key={s.label}
              className={cn(
                "flex-1 rounded-lg px-1.5 py-1.5 text-center text-[10px] font-semibold border",
                s.ok
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
              )}
            >
              {s.label}
            </div>
          ))}
        </div>

        {rows.map(({ id, label, description, icon: Icon, onClick, disabled }) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            onClick={onClick}
            className={cn(
              "w-full flex items-center gap-2.5 px-2.5 py-2 min-h-12 rounded-xl text-left",
              "bg-zinc-50 dark:bg-[#2b2d31] border border-zinc-200/80 dark:border-zinc-800",
              "disabled:opacity-50"
            )}
          >
            <div className="h-9 w-9 rounded-lg bg-zinc-200/80 dark:bg-zinc-700/80 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-zinc-700 dark:text-zinc-200" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">{label}</p>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">{description}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
