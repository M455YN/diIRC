import { useEffect, useMemo, useState } from "react";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Loader2, X } from "lucide-react";
import { format } from "date-fns";

import { UserAvatar } from "@/components/user-avatar";
import {
  getHighlightRanges,
  type HighlightRange,
} from "@/lib/search/search-query";
import {
  useSearchStore,
  type SearchContext,
  type SearchHit,
} from "@/hooks/use-search-store";

interface ChatSearchResultsPanelProps {
  context: SearchContext;
  /** `sidebar` hides below md; `panel` is always visible (mobile sheets). */
  variant?: "sidebar" | "panel";
}

interface HitGroup {
  /** `YYYY-MM-DD` bucket key derived from the log timestamp. */
  dayKey: string;
  dayLabel: string;
  hits: SearchHit[];
}

const parseLogTimestamp = (timestamp: string): Date => {
  const parsed = new Date(timestamp.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

/** English pluralization for the results counter. */
const resultUnit = (count: number): string => {
  return count === 1 ? "result" : "results";
};

const groupHitsByDay = (hits: SearchHit[]): HitGroup[] => {
  const groups: HitGroup[] = [];
  let current: HitGroup | null = null;
  for (const hit of hits) {
    const date = parseLogTimestamp(hit.timestamp);
    const dayKey = format(date, "yyyy-MM-dd");
    if (!current || current.dayKey !== dayKey) {
      current = { dayKey, dayLabel: format(date, "d MMMM yyyy"), hits: [] };
      groups.push(current);
    }
    current.hits.push(hit);
  }
  return groups;
};

/** Renders message content with case-insensitive `<mark>` highlights (no innerHTML). */
const HighlightedContent = ({ content, ranges }: { content: string; ranges: HighlightRange[] }) => {
  if (ranges.length === 0) {
    return <span>{content}</span>;
  }
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((range, index) => {
    if (range.start > cursor) {
      parts.push(<span key={`t-${index}`}>{content.slice(cursor, range.start)}</span>);
    }
    parts.push(
      <mark
        key={`m-${index}`}
        className="bg-yellow-200 text-zinc-900 dark:bg-yellow-500 dark:text-zinc-900 rounded-sm px-0.5"
      >
        {content.slice(range.start, range.end)}
      </mark>
    );
    cursor = range.end;
  });
  if (cursor < content.length) {
    parts.push(<span key="tail">{content.slice(cursor)}</span>);
  }
  return <span>{parts}</span>;
};

const SLICE_SIZE = 50;

/**
 * Discord-style search results panel. Rendered in the right sidebar slot,
 * replacing the members list while a search is active.
 */
export const ChatSearchResultsPanel = ({
  context,
  variant = "sidebar",
}: ChatSearchResultsPanelProps) => {
  const hits = useSearchStore((state) => state.hits);
  const status = useSearchStore((state) => state.status);
  const sort = useSearchStore((state) => state.sort);
  const loadingMore = useSearchStore((state) => state.loadingMore);
  const parsed = useSearchStore((state) => state.parsed);
  const setSort = useSearchStore((state) => state.setSort);
  const closeSearch = useSearchStore((state) => state.closeSearch);
  const removeChipToken = useSearchStore((state) => state.removeChipToken);
  const jumpToHit = useSearchStore((state) => state.jumpToHit);

  const [visibleLimit, setVisibleLimit] = useState(SLICE_SIZE);

  // Reset rendered slice when query or sort changes
  useEffect(() => {
    setVisibleLimit(SLICE_SIZE);
  }, [sort, status]);

  const visibleHits = useMemo(
    () => hits.slice(0, visibleLimit),
    [hits, visibleLimit]
  );

  const groups = useMemo(() => groupHitsByDay(visibleHits), [visibleHits]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 350) {
      if (visibleLimit < hits.length) {
        setVisibleLimit((current) => Math.min(hits.length, current + SLICE_SIZE));
      }
    }
  };

  const title =
    status === "loading"
      ? "Searching…"
      : status === "error"
        ? "Search error"
        : `${hits.length} ${resultUnit(hits.length)}`;

  return (
    <aside
      data-search-results-panel="true"
      className={
        variant === "panel"
          ? "flex flex-col h-full w-full bg-zinc-50 dark:bg-[#2b2d31] shrink-0"
          : "hidden md:flex flex-col h-full w-64 bg-zinc-50 dark:bg-[#2b2d31] border-l border-zinc-200 dark:border-zinc-800 shrink-0"
      }
    >
      {/* Panel header */}
      <div className="h-12 px-3 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 shrink-0">
        <span className="font-semibold text-sm text-black dark:text-white truncate" title={title}>
          {title}
        </span>
        <div className="flex items-center gap-x-1 shrink-0">
          <button
            onClick={() => setSort(sort === "newest" ? "oldest" : "newest", context)}
            title={sort === "newest" ? "Sort: newest first (click to switch to oldest)" : "Sort: oldest first (click to switch to newest)"}
            className="flex items-center gap-x-1 px-1.5 py-1 rounded text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60 transition font-medium"
          >
            {sort === "newest" ? (
              <>
                <ArrowDownWideNarrow className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                <span className="text-[11px] hidden sm:inline">Newest</span>
              </>
            ) : (
              <>
                <ArrowUpNarrowWide className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400 shrink-0" />
                <span className="text-[11px] hidden sm:inline">Oldest</span>
              </>
            )}
          </button>
          <button
            onClick={closeSearch}
            title="Close results (Escape)"
            className="p-1.5 rounded hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50 transition text-zinc-500 dark:text-zinc-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter chips */}
      {parsed.chips.length > 0 && (
        <div className="px-3 py-2 flex flex-wrap gap-1.5 border-b border-zinc-200 dark:border-[#3f4147]">
          {parsed.chips.map((chip, index) => {
            const isOperator = chip.type !== "text" && chip.type !== "phrase" && chip.type !== "exclude";
            return (
              <button
                key={`${chip.type}:${chip.value}:${index}`}
                onClick={() => removeChipToken(chip.token)}
                title="Click to remove filter"
                className="inline-flex items-center gap-x-1 px-2 py-0.5 rounded-full text-xs bg-zinc-200 text-zinc-800 hover:bg-zinc-300 dark:bg-[#3f4147] dark:text-zinc-100 dark:hover:bg-[#4a4d55] transition"
              >
                {isOperator && <span className="opacity-70">{chip.type}:</span>}
                <span className="font-medium max-w-[140px] truncate">{chip.value}</span>
                <span aria-hidden className="opacity-60">×</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Results with infinite scrolling */}
      <div
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden py-2 discord-scrollbar-ghost"
      >
        {status === "loading" && (
          <div className="flex items-center justify-center gap-x-2 py-8 text-sm text-zinc-500 dark:text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            Searching…
          </div>
        )}

        {status === "idle" && (
          <div className="px-3 py-8 text-center text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
            Type a phrase or use filters:
            <br />
            <code className="text-[11px]">from:</code>{" "}
            <code className="text-[11px]">mentions:</code>{" "}
            <code className="text-[11px]">before:date</code>
            <br />
            Regex in slashes, e.g. <code className="text-[11px]">/message \d+:/</code>
          </div>
        )}

        {status === "done" && hits.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No results found
          </div>
        )}

        {status === "error" && (
          <div className="px-3 py-8 text-center text-xs text-red-500 dark:text-red-400 break-words">
            Search failed.
          </div>
        )}

        {status === "done" &&
          groups.map((group) => (
            <div key={group.dayKey}>
              <div className="sticky top-0 z-10 mx-3 my-1.5 px-2 py-1 rounded bg-zinc-200/90 dark:bg-[#1e1f22]/95 text-center text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 backdrop-blur-sm">
                {group.dayLabel}
              </div>
              {group.hits.map((hit) => (
                <button
                  key={`${hit.offset}-${hit.timestamp}`}
                  onClick={() => void jumpToHit(hit, context)}
                  className="w-full text-left mx-2 px-2 py-1.5 rounded-md hover:bg-zinc-200/60 dark:hover:bg-zinc-700/40 transition"
                >
                  <div className="flex items-center gap-x-2 min-w-0">
                    <UserAvatar
                      src=""
                      name={hit.sender}
                      className="h-6 w-6 shrink-0"
                    />
                    <span className="text-sm font-semibold text-black dark:text-white truncate">
                      {hit.sender}
                    </span>
                    <span className="ml-auto text-[11px] text-zinc-500 dark:text-zinc-400 shrink-0">
                      {hit.timestamp.slice(11)}
                    </span>
                  </div>
                  <p className="mt-0.5 ml-8 text-[13px] leading-snug text-zinc-600 dark:text-zinc-300 break-words line-clamp-3">
                    <HighlightedContent
                      content={hit.content}
                      ranges={getHighlightRanges(hit.content, parsed)}
                    />
                  </p>
                </button>
              ))}
            </div>
          ))}

        {loadingMore && (
          <div className="flex items-center justify-center gap-x-2 py-3 text-xs text-zinc-500 dark:text-zinc-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Searching more messages in background…
          </div>
        )}

        {status === "done" && !loadingMore && hits.length > 0 && (
          <div className="py-3 text-[11px] text-center text-zinc-400 dark:text-zinc-500">
            End of search results ({hits.length} {hits.length === 1 ? "message" : "messages"})
          </div>
        )}
      </div>
    </aside>
  );
};
