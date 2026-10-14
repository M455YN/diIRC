import { useTranslation } from "react-i18next";
import { ChannelType, ServerWithMembersWithProfiles } from "@/types";
import { Plus, Settings } from "lucide-react";

import { ActionTooltip } from "@/components/action-tooltip";
import { useModal } from "@/hooks/use-modal-store";

interface ServerSectionProps {
  label: string;
  sectionType: "channels" | "members";
  channelType?: ChannelType;
  server?: ServerWithMembersWithProfiles;
}

export const ServerSection = ({
  label,
  sectionType,
  channelType,
  server,
}: ServerSectionProps) => {
  const { t } = useTranslation();
  const { onOpen } = useModal();

  return (
    <div className="flex items-center justify-between py-2">
      <p className="text-xs uppercase font-semibold text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      {sectionType === "channels" && (
        <ActionTooltip label={t("srv.joinChannel")} side="top">
          <button
            onClick={() => onOpen("createChannel", { channelType, server })}
            className="text-zinc-500 hover:text-zinc-600 dark:text-zinc-400 dark:hover:text-zinc-300 transition"
          >
            <Plus className="h-4 w-4" />
          </button>
        </ActionTooltip>
      )}
    </div>
  );
};
