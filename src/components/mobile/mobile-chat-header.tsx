import { ChevronLeft, Hash, MoreHorizontal, Search, Users } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

interface MobileChatHeaderProps {
  name: string;
  type: "channel" | "conversation";
  imageUrl?: string;
  statusLabel?: string;
  online?: boolean;
  onBack: () => void;
  onMembers?: () => void;
  onSearch?: () => void;
  showMembers?: boolean;
}

export const MobileChatHeader = ({
  name,
  type,
  imageUrl,
  statusLabel,
  online,
  onBack,
  onMembers,
  onSearch,
  showMembers,
}: MobileChatHeaderProps) => {
  return (
    <div
      className={cn(
        "mobile-safe-top z-20 shrink-0",
        "border-b border-border/40",
        "bg-secondary/55 dark:bg-secondary/40",
        "backdrop-blur-2xl backdrop-saturate-150"
      )}
    >
      <div className="mobile-chrome-bar flex min-w-0 items-center gap-1 px-1.5">
        <button
          type="button"
          onClick={onBack}
          className="flex h-10 w-9 shrink-0 items-center justify-center text-blue-500 active:opacity-60"
          aria-label="Back"
        >
          <ChevronLeft className="h-7 w-7 stroke-[2]" />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          {type === "channel" ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-500">
              <Hash className="h-4 w-4" />
            </div>
          ) : (
            <UserAvatar src={imageUrl} name={name} className="h-9 w-9 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="truncate text-[16px] font-medium leading-tight text-foreground">
              {name}
            </p>
            {(statusLabel || online !== undefined) && (
              <p className="flex items-center gap-1 truncate text-[12px] font-normal text-muted-foreground">
                {online && (
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
                )}
                {statusLabel || (online ? "Online" : "Away")}
              </p>
            )}
          </div>
        </div>

        {onSearch && (
          <button
            type="button"
            onClick={onSearch}
            className="flex h-10 w-10 shrink-0 items-center justify-center text-blue-500 active:opacity-60"
            aria-label="Search"
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
        )}

        {onMembers && (
          <button
            type="button"
            onClick={onMembers}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center active:opacity-60",
              showMembers ? "text-blue-600" : "text-blue-500"
            )}
            aria-label={type === "channel" ? "Members" : "More"}
          >
            {type === "channel" ? (
              <Users className="h-[18px] w-[18px]" />
            ) : (
              <MoreHorizontal className="h-5 w-5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
};
