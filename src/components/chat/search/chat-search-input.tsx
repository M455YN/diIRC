import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, Hash, Search, User, X } from "lucide-react";

import { ActionTooltip } from "@/components/action-tooltip";
import { DateCalendar } from "@/components/chat/search/date-calendar";
import { parseSearchQuery } from "@/lib/search/search-query";
import { useSearchStore, type SearchContext } from "@/hooks/use-search-store";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 500;
const MAX_SUGGESTIONS = 8;

/** Member entry for from:/mentions: autocompletion (nick + optional realname). */
export interface SearchMemberOption {
  name: string;
  realname?: string;
}

interface ChatSearchInputProps {
  context: SearchContext;
  /** Server members for `from:` / `mentions:` autocompletion. */
  members?: SearchMemberOption[];
}

interface OperatorSuggestion {
  insert: string;
  label: string;
  description: string;
  icon: "user" | "hash" | "calendar";
}

// Only operators that are reliably detectable in raw IRC log text
// (timestamp / sender / content). `has:*` removed — content-type detection
// proved unreliable; bare regexes cover power users instead.
const OPERATOR_SUGGESTIONS: OperatorSuggestion[] = [
  { insert: "from:", label: "from:", description: "cb.fromUser", icon: "user" },
  { insert: "mentions:", label: "mentions:", description: "cb.mentionsUser", icon: "user" },
  { insert: "before:", label: "before:", description: "cb.olderThan", icon: "calendar" },
  { insert: "after:", label: "after:", description: "cb.newerThan", icon: "calendar" },
  { insert: "during:", label: "during:", description: "cb.specificDay", icon: "calendar" },
];

type ActivePopup =
  | { kind: "operators"; items: OperatorSuggestion[] }
  | { kind: "members"; key: "from" | "mentions"; items: SearchMemberOption[] }
  | { kind: "date"; key: "before" | "after" | "during" }
  | null;

/** Returns the whitespace-delimited token that starts at/before the caret. */
const getTokenAtCaret = (
  text: string,
  caret: number
): { start: number; token: string } => {
  const { t: tr } = useTranslation();
  const safeCaret = Math.max(0, Math.min(caret, text.length));
  const start = text.lastIndexOf(" ", Math.max(0, safeCaret - 1)) + 1;
  return { start, token: text.slice(start, safeCaret) };
};

/**
 * Discord-style search box living in the channel header.
 * Collapsed: a single magnifier button. Expanded: an inline input with a debounced
 * live search plus an autocomplete dropdown — operator tags, member suggestions
 * (`from:`/`mentions:` match nick AND realname), `has:*` values and a calendar
 * for date filters.
 */
export const ChatSearchInput = ({ context, members = [] }: ChatSearchInputProps) => {
  const { t: tr } = useTranslation();
  const open = useSearchStore((state) => state.open);
  const rawQuery = useSearchStore((state) => state.rawQuery);
  const openSearch = useSearchStore((state) => state.openSearch);
  const closeSearch = useSearchStore((state) => state.closeSearch);
  const setQuery = useSearchStore((state) => state.setQuery);
  const runSearch = useSearchStore((state) => state.runSearch);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const caretRef = useRef(0);
  const [popup, setPopup] = useState<ActivePopup>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const { type, chatId, serverId, target } = context;

  // Close suggestion popup when clicking outside the search container
  useEffect(() => {
    if (!popup) return;

    const handlePointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Element | null;
      if (!target) return;

      if (containerRef.current?.contains(target)) {
        return;
      }

      setPopup(null);
    };

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [popup]);

  // Debounced live search; fires immediately for the empty query (clears results).
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      void runSearch({ type, chatId, serverId, target });
    }, rawQuery ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawQuery, type, chatId, serverId, target, open]);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    } else {
      setPopup(null);
    }
  }, [open]);

  const sortedMembers = useMemo(
    () =>
      [...members.filter((m) => m.name)].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [members]
  );

  // Show the suggestion dropdown immediately when the search opens (empty token =
  // all operators) so suggestions are visible by default, not only after typing.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      const element = inputRef.current;
      if (!element) return;
      const caret = element.selectionStart ?? element.value.length;
      refreshSuggestions(element.value, caret);
    });
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sortedMembers]);

  /** Recomputes which popup should be visible for the current token under the caret. */
  const refreshSuggestions = (text: string, caret: number) => {
    caretRef.current = caret;
    const { token } = getTokenAtCaret(text, caret);
    setActiveIndex(0);

    const colonIndex = token.indexOf(":");
    if (colonIndex === -1) {
      // Find tags that are already used in the query so we don't suggest duplicate tags
      const existingKeys = new Set<string>();
      const parsed = parseSearchQuery(text);
      if (parsed.criteria.sender) existingKeys.add("from:");
      if (parsed.criteria.mention) existingKeys.add("mentions:");
      for (const chip of parsed.chips) {
        if (chip.type === "from") existingKeys.add("from:");
        if (chip.type === "mentions") existingKeys.add("mentions:");
        if (chip.type === "before") {
          existingKeys.add("before:");
          existingKeys.add("during:");
        }
        if (chip.type === "after") {
          existingKeys.add("after:");
          existingKeys.add("during:");
        }
        if (chip.type === "during") {
          existingKeys.add("during:");
          existingKeys.add("before:");
          existingKeys.add("after:");
        }
      }

      // No operator yet — suggest operator tags matching the typed prefix (excluding already present tags).
      const query = token.toLowerCase();
      const items = OPERATOR_SUGGESTIONS.filter((suggestion) =>
        !existingKeys.has(suggestion.insert) && suggestion.label.startsWith(query)
      ).map((suggestion) => ({ ...suggestion, description: tr(suggestion.description) }));
      setPopup(items.length > 0 ? { kind: "operators", items } : null);
      return;
    }

    const key = token.slice(0, colonIndex).toLowerCase();
    const value = token.slice(colonIndex + 1).replace(/^@/, "");

    if (key === "from" || key === "mentions") {
      const needle = value.toLowerCase();
      const matched = sortedMembers.filter(
        (member) =>
          member.name.toLowerCase().includes(needle) ||
          (member.realname && member.realname.toLowerCase().includes(needle))
      );
      setPopup({
        kind: "members",
        key,
        items: matched.slice(0, MAX_SUGGESTIONS),
      });
      return;
    }

    if (key === "before" || key === "after" || key === "during") {
      // Calendar opens automatically; manual typing stays possible underneath.
      setPopup({ kind: "date", key });
      return;
    }

    setPopup(null);
  };

  /**
   * Replaces the current token with `insertText` and puts the caret right after it.
   *
   * Value-taking operators (`from:`, `mentions:`, `has:`) get NO trailing space —
   * the caret must sit directly after the colon so the token under it stays e.g.
   * `from:` and the NEXT suggestion tier (nicks / has-values) opens immediately.
   * Complete tokens (a picked date like `before:2026-08-24`) get a trailing space
   * to terminate the token.
   */
  const applySuggestion = (insertText: string, options?: { trailingSpace?: boolean }) => {
    let currentQuery = rawQuery;
    // `during:` is mutually exclusive with `before:` and `after:`.
    if (insertText.startsWith("during:")) {
      currentQuery = currentQuery.replace(/\b(?:before|after):[^\s]+\s*/gi, "");
    } else if (insertText.startsWith("before:") || insertText.startsWith("after:")) {
      currentQuery = currentQuery.replace(/\bduring:[^\s]+\s*/gi, "");
    }

    const safeCaret = Math.min(caretRef.current, currentQuery.length);
    const { start } = getTokenAtCaret(currentQuery, safeCaret);
    const trailingSpace = options?.trailingSpace ?? false;
    const inserted = trailingSpace ? `${insertText} ` : insertText;
    const next = currentQuery.slice(0, start) + inserted + currentQuery.slice(safeCaret);
    const cleaned = next.replace(/\s{2,}/g, " ").replace(/^\s+/, "");
    const removedBefore = next.length - cleaned.length;
    setQuery(cleaned);
    const caretPosition = start + inserted.length - removedBefore;
    // Recompute suggestions for the NEW token under the caret (programmatic
    // setQuery does not fire onChange) — e.g. `from:` immediately opens nicks.
    requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(caretPosition, caretPosition);
      caretRef.current = caretPosition;
      refreshSuggestions(cleaned, caretPosition);
    });
  };

  const handleSelectDate = (key: "before" | "after" | "during", day: Date) => {
    // Complete value — terminate the token with a space.
    applySuggestion(`${key}:${formatDay(day)}`, { trailingSpace: true });
  };

  /** Applies the currently highlighted suggestion (keyboard Enter). */
  const selectActive = () => {
    if (!popup || popup.kind === "date") return;
    if (popup.kind === "members") {
      const member = popup.items[activeIndex];
      if (member) {
        // Complete value — terminate the token with a space.
        applySuggestion(`${popup.key}:${member.name}`, { trailingSpace: true });
      }
      return;
    }
    const item = popup.items[activeIndex];
    if (!item) return;
    applySuggestion(item.insert);
  };

  const popupItems = popup && popup.kind !== "date" ? popup.items : [];
  const hasSelectableItems = popup !== null && popup.kind !== "date";

  if (!open) {
    return (
      <ActionTooltip side="bottom" label={tr("cb.search")}>
        <button
          onClick={openSearch}
          className="flex items-center justify-center p-1.5 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50 transition"
        >
          <Search className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
        </button>
      </ActionTooltip>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          "flex items-center gap-x-1.5 h-8 px-2 rounded-md",
          "bg-white dark:bg-[#1e1f22] ring-1 ring-zinc-300 dark:ring-[#3f4147]",
          "focus-within:ring-indigo-500 dark:focus-within:ring-indigo-400 transition w-[170px] sm:w-[220px]"
        )}
      >
        <Search className="w-3.5 h-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
        <input
          ref={inputRef}
          value={rawQuery}
          onChange={(event) => {
            setQuery(event.target.value);
            refreshSuggestions(event.target.value, event.target.selectionStart ?? event.target.value.length);
          }}
          onFocus={(event) =>
            refreshSuggestions(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)
          }
          onClick={(event) =>
            refreshSuggestions(event.currentTarget.value, event.currentTarget.selectionStart ?? 0)
          }
          onKeyUp={(event) => {
            if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home" || event.key === "End") {
              refreshSuggestions(event.currentTarget.value, event.currentTarget.selectionStart ?? 0);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.stopPropagation();
              if (popup) {
                setPopup(null); // first Escape closes only the popup
              } else {
                closeSearch();
              }
              return;
            }
            if (hasSelectableItems && popupItems.length > 0) {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => (index + 1) % popupItems.length);
                return;
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => (index - 1 + popupItems.length) % popupItems.length);
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                selectActive();
                return;
              }
            }
            if (event.key === "Enter") {
              event.preventDefault();
              setPopup(null);
              void runSearch({ type, chatId, serverId, target });
              return;
            }
          }}
          placeholder={tr("cb.search")}
          spellCheck={false}
          className="flex-1 min-w-0 bg-transparent border-none outline-none text-sm text-black dark:text-white placeholder:text-zinc-400 dark:placeholder:text-zinc-500"
        />
        <button
          onClick={closeSearch}
          title={tr("cb.closeSearch")}
          className="shrink-0 p-0.5 rounded hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60 transition"
        >
          <X className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
        </button>
      </div>

      {/* Autocomplete dropdown */}
      {popup && (
        <div
          className="absolute left-auto right-0 top-full mt-1 max-w-[calc(100vw-1rem)] max-h-[420px] overflow-y-auto z-50 rounded-md border border-zinc-200 dark:border-[#3f4147] bg-white dark:bg-[#1e1f22] shadow-xl discord-scrollbar-ghost"
          style={{ width: "min(420px, calc(100vw - 1rem))" }}
        >
          {popup.kind === "operators" && (
            <>
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Filters
              </p>
              {popup.items.map((item, index) => (
                <SuggestionRow
                  key={item.insert}
                  active={index === activeIndex}
                  onHover={() => setActiveIndex(index)}
                  onSelect={() => applySuggestion(item.insert)}
                  icon={<ItemIcon icon={item.icon} />}
                  label={item.label}
                  description={item.description}
                />
              ))}
            </>
          )}

          {popup.kind === "members" && (
            <>
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Users
              </p>
              {popup.items.length === 0 ? (
                <p className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {tr("cb.typeManually")}
                </p>
              ) : (
                popup.items.map((member, index) => (
                  <SuggestionRow
                    key={`${popup.key}:${member.name}`}
                    active={index === activeIndex}
                    onHover={() => setActiveIndex(index)}
                    onSelect={() => applySuggestion(`${popup.key}:${member.name}`, { trailingSpace: true })}
                    icon={<User className="w-3.5 h-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />}
                    label={member.name}
                    description={member.realname || popup.key}
                  />
                ))
              )}
            </>
          )}

          {popup.kind === "date" && (
            <>
              <p className="px-3 pt-2 pb-1 flex items-center gap-x-1.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                <CalendarDays className="w-3 h-3" />
                Pick date for “{popup.key}:” — or type manually
              </p>
              <DateCalendar onSelect={(day) => handleSelectDate(popup.key, day)} />
            </>
          )}
        </div>
      )}
    </div>
  );
};

/** Shared suggestion row with consistent light/dark styling. */
const SuggestionRow = ({
  active,
  onHover,
  onSelect,
  icon,
  label,
  description,
}: {
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
  icon: React.ReactNode;
  label: string;
  description?: string;
}) => (
  <button
    onMouseDown={(event) => event.preventDefault()}
    onClick={onSelect}
    onMouseEnter={onHover}
    className={cn(
      "w-full flex items-start gap-x-2 px-3 py-2 text-left transition-colors",
      active ? "bg-zinc-100 dark:bg-[#2b2d31]" : ""
    )}
  >
    {icon}
    <span className="shrink-0 text-sm font-medium text-zinc-900 dark:text-[#f2f3f5] whitespace-nowrap">
      {label}
    </span>
    {description && (
      <span className="min-w-0 flex-1 text-[11px] leading-snug text-zinc-500 dark:text-zinc-400 whitespace-normal break-words pl-2">
        {description}
      </span>
    )}
  </button>
);

const ItemIcon = ({ icon }: { icon: OperatorSuggestion["icon"] }) => {
  if (icon === "user") {
    return <User className="w-3.5 h-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />;
  }
  if (icon === "calendar") {
    return <CalendarDays className="w-3.5 h-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />;
  }
  return <Hash className="w-3.5 h-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />;
};

const formatDay = (day: Date): string => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
};
