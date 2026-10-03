import { ArrowLeft, Hash, Search, Users } from "lucide-react";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";

interface MobileChatHeaderProps {
  name: string;
  type: "channel" | "conversation";
  imageUrl?: string;
  onBack: () => void;
  onMembers?: () => void;
  onSearch?: () => void;
  showMembers?: boolean;
}

export const MobileChatHeader = ({
  name,
  type,
  imageUrl,
  onBack,
  onMembers,
  onSearch,
  showMembers,
}: MobileChatHeaderProps) => {
  return (
    <div className="mobile-safe-top shrink-0 z-20 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#313338]">
      <div className="mobile-chrome-bar px-1 flex items-center gap-0.5 min-w-0">
        <button
          type="button"
          onClick={onBack}
          className="h-10 w-10 flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-300 shrink-0"
          aria-label="Back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {type === "channel" ? (
            <Hash className="w-4 h-4 text-zinc-500 shrink-0" />
          ) : (
            <UserAvatar src={imageUrl} name={name} className="h-7 w-7 shrink-0" />
          )}
          <p className="font-semibold text-sm text-zinc-900 dark:text-white truncate">
            {name}
          </p>
        </div>

        {onSearch && (
          <button
            type="button"
            onClick={onSearch}
            className="h-10 w-10 flex items-center justify-center rounded-lg text-zinc-600 dark:text-zinc-300 shrink-0"
            aria-label="Search"
          >
            <Search className="w-4 h-4" />
          </button>
        )}

        {onMembers && (
          <button
            type="button"
            onClick={onMembers}
            className={cn(
              "h-10 w-10 flex items-center justify-center rounded-lg shrink-0",
              showMembers
                ? "text-indigo-500 dark:text-indigo-400"
                : "text-zinc-600 dark:text-zinc-300"
            )}
            aria-label="Members"
          >
            <Users className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};
