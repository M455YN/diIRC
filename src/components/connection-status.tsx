import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useConnectionStatus } from "@/hooks/use-connection-status";
import { useMockStore } from "@/lib/mock-store";
import { useModal } from "@/hooks/use-modal-store";
import { ActionTooltip } from "@/components/action-tooltip";
import { cn } from "@/lib/utils";
import { Server } from "@/types";

interface ConnectionStatusProps {
  serverId?: string;
  server?: Server;
}

export const ConnectionStatus = ({ serverId: propServerId, server }: ConnectionStatusProps = {}) => {
  const params = useParams();
  const serverId = propServerId || server?.id || params.serverId;
  const { irc, ircError, resourceServer, internet } = useConnectionStatus(serverId);
  const statusDisplayMode = useMockStore((state) => state.statusDisplayMode) || "always";
  const { onOpen } = useModal();
  const { t } = useTranslation();

  const hasError = !irc || !resourceServer || !internet;

  if (statusDisplayMode === "disabled") {
    return null;
  }

  if (statusDisplayMode === "on_error" && !hasError) {
    return null;
  }

  const ircTooltipLabel = irc
    ? `${t("connStatus.ircServer")}: ${t("connStatus.connected")} (${t("connStatus.clickDetailsLogs")})`
    : `${t("connStatus.ircServer")}: ${t("connStatus.disconnected")}${ircError ? ` (${ircError})` : ""} - ${t("connStatus.clickDetailsLogs")}`;

  const statuses = [
    {
      id: "irc",
      name: t("connStatus.ircServer"),
      status: irc,
      tooltip: ircTooltipLabel,
    },
    {
      id: "resource",
      name: t("connStatus.resourceServer"),
      status: resourceServer,
      tooltip: `${t("connStatus.resourceServer")}: ${resourceServer ? t("connStatus.connected") : t("connStatus.disabled")} (${t("connStatus.clickDetails")})`,
    },
    {
      id: "internet",
      name: t("connStatus.internet"),
      status: internet,
      tooltip: `${t("connStatus.internet")}: ${internet ? t("connStatus.online") : t("connStatus.offline")} (${t("connStatus.clickDetails")})`,
    },
  ];

  return (
    <div className="relative group z-30">
      <div
        onClick={() => onOpen("connectionDetails", { serverId, server })}
        className={cn(
          "flex items-center gap-x-2.5 px-3 py-1.5 rounded-full",
          "border border-zinc-200 dark:border-zinc-700/80",
          "bg-white/80 dark:bg-[#1e1f22]/90 backdrop-blur-md",
          "shadow-sm hover:shadow-md transition-all duration-300 ease-in-out cursor-pointer",
          "select-none hover:border-indigo-500/50"
        )}
      >
        {statuses.map((item, index) => (
          <ActionTooltip key={item.id} label={item.tooltip} side="bottom">
            <div className="flex items-center">
              {/* Separator dot between items in expanded state */}
              {index > 0 && (
                <span className="w-0 opacity-0 group-hover:w-auto group-hover:opacity-100 group-hover:mr-2.5 text-zinc-300 dark:text-zinc-700 transition-all duration-300 select-none">
                  •
                </span>
              )}

              {/* Static Status Dot */}
              <div className="flex items-center justify-center">
                <span
                  className={cn(
                    "w-2.5 h-2.5 rounded-full shrink-0 transition-colors duration-200",
                    item.status ? "bg-emerald-500" : "bg-rose-500"
                  )}
                />
              </div>

              {/* Expanded Label Text (Expands horizontally on hover without status text) */}
              <div className="max-w-0 opacity-0 group-hover:max-w-[150px] group-hover:opacity-100 group-hover:ml-2 transition-all duration-300 ease-in-out overflow-hidden whitespace-nowrap text-xs">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {item.name}
                </span>
              </div>
            </div>
          </ActionTooltip>
        ))}
      </div>
    </div>
  );
};
