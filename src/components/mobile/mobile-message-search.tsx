import { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import CircularProgress from "@mui/material/CircularProgress";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlineOutlined";
import AlternateEmailIcon from "@mui/icons-material/AlternateEmail";
import EventIcon from "@mui/icons-material/Event";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import SearchOffIcon from "@mui/icons-material/SearchOff";
import ManageSearchIcon from "@mui/icons-material/ManageSearch";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import type { SearchMemberOption } from "@/components/chat/search/chat-search-input";
import { HighlightedContent, groupHitsByDay } from "@/components/chat/search/search-results-panel";
import { getHighlightRanges } from "@/lib/search/search-query";
import { useSearchStore, type SearchContext } from "@/hooks/use-search-store";
import {
  M3Chip,
  M3IconButton,
  M3ListGroup,
  M3ListItem,
  M3Provider,
  M3Subheader,
  useM3,
} from "@/components/mobile/m3";

const SEARCH_DEBOUNCE_MS = 500;
const SLICE_SIZE = 50;
const MAX_MEMBER_SUGGESTIONS = 30;

type DateKey = "before" | "after" | "during";
type UserKey = "from" | "mentions";

const FILTERS: { key: UserKey | DateKey; label: string; icon: React.ReactNode }[] = [
  { key: "from", label: "From user", icon: <PersonOutlineIcon /> },
  { key: "mentions", label: "Mentions user", icon: <AlternateEmailIcon /> },
  { key: "before", label: "Before date", icon: <EventIcon /> },
  { key: "after", label: "After date", icon: <EventIcon /> },
  { key: "during", label: "On date", icon: <EventIcon /> },
];

const lastToken = (text: string) => {
  const start = text.lastIndexOf(" ") + 1;
  return { start, token: text.slice(start) };
};

interface MobileMessageSearchProps {
  open: boolean;
  onClose: () => void;
  context: SearchContext;
  members: SearchMemberOption[];
}

/** Material 3 full-screen search view for channel / conversation history. */
export const MobileMessageSearch = ({ open, onClose, context, members }: MobileMessageSearchProps) => (
  <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
    <DialogContent
      hideClose
      aria-describedby={undefined}
      onOpenAutoFocus={(e) => e.preventDefault()}
      className="grid-rows-[minmax(0,1fr)] overflow-hidden border-0 p-0 shadow-none"
    >
      <M3Provider>
        <SearchView onClose={onClose} context={context} members={members} />
      </M3Provider>
    </DialogContent>
  </Dialog>
);

const SearchView = ({
  onClose,
  context,
  members,
}: Omit<MobileMessageSearchProps, "open">) => {
  const t = useM3();
  const rawQuery = useSearchStore((s) => s.rawQuery);
  const setQuery = useSearchStore((s) => s.setQuery);
  const runSearch = useSearchStore((s) => s.runSearch);
  const hits = useSearchStore((s) => s.hits);
  const status = useSearchStore((s) => s.status);
  const sort = useSearchStore((s) => s.sort);
  const setSort = useSearchStore((s) => s.setSort);
  const loadingMore = useSearchStore((s) => s.loadingMore);
  const parsed = useSearchStore((s) => s.parsed);
  const removeChipToken = useSearchStore((s) => s.removeChipToken);
  const jumpToHit = useSearchStore((s) => s.jumpToHit);

  const inputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const pendingDateKey = useRef<DateKey>("before");
  const [visibleLimit, setVisibleLimit] = useState(SLICE_SIZE);

  const { type, chatId, serverId, target } = context;

  useEffect(() => {
    const timer = setTimeout(() => {
      void runSearch({ type, chatId, serverId, target });
    }, rawQuery ? SEARCH_DEBOUNCE_MS : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawQuery, type, chatId, serverId, target]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => setVisibleLimit(SLICE_SIZE), [sort, status]);

  const { token } = lastToken(rawQuery);
  const userMatch = /^(from|mentions):@?(.*)$/i.exec(token);
  const userKey = userMatch ? (userMatch[1].toLowerCase() as UserKey) : null;
  const userNeedle = userMatch ? userMatch[2].toLowerCase() : "";

  const memberSuggestions = useMemo(() => {
    if (!userKey) return [];
    return members
      .filter(
        (m) =>
          m.name &&
          (m.name.toLowerCase().includes(userNeedle) ||
            m.realname?.toLowerCase().includes(userNeedle))
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, MAX_MEMBER_SUGGESTIONS);
  }, [members, userKey, userNeedle]);

  const usedKeys = new Set<string>(parsed.chips.map((c) => c.type));
  if (parsed.criteria.sender) usedKeys.add("from");
  if (parsed.criteria.mention) usedKeys.add("mentions");
  const hasDateRange = usedKeys.has("before") || usedKeys.has("after");
  const availableFilters = FILTERS.filter((f) => {
    if (usedKeys.has(f.key)) return false;
    if (f.key === "during") return !hasDateRange;
    if (f.key === "before" || f.key === "after") return !usedKeys.has("during");
    return true;
  });

  /** Replaces the trailing token (or appends) with `text`. */
  const replaceLastToken = (text: string) => {
    const { start } = lastToken(rawQuery);
    const next = `${rawQuery.slice(0, start)}${text}`.replace(/\s{2,}/g, " ").replace(/^\s+/, "");
    setQuery(next);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.length, next.length);
    });
  };

  const appendToken = (text: string) => {
    const base = rawQuery.trim();
    const next = base ? `${base} ${text}` : text;
    setQuery(next);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(next.length, next.length);
    });
  };

  const applyFilter = (key: UserKey | DateKey) => {
    if (key === "from" || key === "mentions") {
      appendToken(`${key}:`);
      return;
    }
    pendingDateKey.current = key;
    const el = dateInputRef.current;
    if (!el) return;
    el.value = "";
    try {
      el.showPicker();
    } catch {
      el.click();
    }
  };

  const onDatePicked = (value: string) => {
    if (!value) return;
    const key = pendingDateKey.current;
    let base = rawQuery;
    if (key === "during") base = base.replace(/\b(?:before|after):\S+\s*/gi, "");
    else base = base.replace(/\bduring:\S+\s*/gi, "");
    base = base.trim();
    setQuery(`${base ? `${base} ` : ""}${key}:${value} `);
  };

  const visibleHits = useMemo(() => hits.slice(0, visibleLimit), [hits, visibleLimit]);
  const groups = useMemo(() => groupHitsByDay(visibleHits), [visibleHits]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 400 && visibleLimit < hits.length) {
      setVisibleLimit((n) => Math.min(hits.length, n + SLICE_SIZE));
    }
  };

  const openHit = (hit: (typeof hits)[number]) => {
    void jumpToHit(hit, context);
    onClose();
  };

  const emptyState = (icon: React.ReactNode, title: string, body?: React.ReactNode) => (
    <Box sx={{ px: 4, py: 8, textAlign: "center", color: t.onSurfaceVariant }}>
      <Box sx={{ "& .MuiSvgIcon-root": { fontSize: 40 }, mb: 1.5 }}>{icon}</Box>
      <Box sx={{ fontSize: "1rem", color: t.onSurface, mb: 0.5 }}>{title}</Box>
      {body && <Box sx={{ fontSize: "0.875rem", lineHeight: "20px" }}>{body}</Box>}
    </Box>
  );

  return (
    <Box
      sx={{
        height: "100%",
        width: "100%",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        bgcolor: t.surface,
        color: t.onSurface,
        fontFamily: "Roboto, system-ui, sans-serif",
      }}
    >
      <DialogTitle className="sr-only">Search messages</DialogTitle>

      {/* Search view header — https://m3.material.io/components/search/specs */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          height: 72,
          px: 0.5,
          flexShrink: 0,
          bgcolor: t.surfaceContainerHigh,
        }}
      >
        <M3IconButton icon={<ArrowBackIcon />} label="Back" onClick={onClose} color={t.onSurface} />
        <Box
          component="input"
          ref={inputRef}
          value={rawQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuery(e.target.value)}
          onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Enter") {
              e.preventDefault();
              inputRef.current?.blur();
              void runSearch(context);
            }
          }}
          placeholder={`Search in ${target}`}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          enterKeyHint="search"
          sx={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            border: 0,
            outline: "none",
            bgcolor: "transparent",
            color: t.onSurface,
            fontFamily: "inherit",
            fontSize: "1rem",
            letterSpacing: "0.5px",
            px: 0.5,
            "&::placeholder": { color: t.onSurfaceVariant, opacity: 1 },
          }}
        />
        {rawQuery && (
          <M3IconButton
            icon={<CloseIcon />}
            label="Clear"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          />
        )}
      </Box>
      <Box sx={{ height: "1px", bgcolor: t.outlineVariant, flexShrink: 0 }} />

      <input
        ref={dateInputRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => onDatePicked(e.target.value)}
        style={{ position: "absolute", opacity: 0, pointerEvents: "none", width: 0, height: 0 }}
      />

      <Box onScroll={handleScroll} sx={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
        {userKey ? (
          <>
            <M3Subheader>{userKey === "from" ? "Messages from" : "Messages mentioning"}</M3Subheader>
            {memberSuggestions.length === 0 ? (
              <Box sx={{ px: 2.5, py: 1, fontSize: "0.875rem", color: t.onSurfaceVariant }}>
                No matching users — keep typing a nick or real name.
              </Box>
            ) : (
              <Box sx={{ px: 2 }}>
                <M3ListGroup>
                  {memberSuggestions.map((m, i) => (
                    <M3ListItem
                      key={m.name}
                      leading={<UserAvatar src="" name={m.name} className="h-10 w-10 md:h-10 md:w-10" />}
                      headline={m.name}
                      supporting={m.realname && m.realname !== m.name ? m.realname : undefined}
                      onClick={() => replaceLastToken(`${userKey}:${m.name} `)}
                      divider={i < memberSuggestions.length - 1}
                    />
                  ))}
                </M3ListGroup>
              </Box>
            )}
          </>
        ) : (
          <>
            {(parsed.chips.some((c) => c.type !== "text") || availableFilters.length > 0) && (
              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  px: 2,
                  py: 1.5,
                  overflowX: "auto",
                  scrollbarWidth: "none",
                  "&::-webkit-scrollbar": { display: "none" },
                }}
              >
                {parsed.chips
                  .filter((c) => c.type !== "text")
                  .map((chip, i) => (
                    <M3Chip
                      key={`${chip.token}:${i}`}
                      tone="primary"
                      label={
                        <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 180 }}>
                          {chip.type === "phrase" || chip.type === "exclude" || chip.type === "regex"
                            ? chip.value
                            : `${chip.type}: ${chip.value}`}
                        </Box>
                      }
                      trailingIcon={<CloseIcon />}
                      onClick={() => removeChipToken(chip.token)}
                    />
                  ))}
                {availableFilters.map((f) => (
                  <M3Chip key={f.key} icon={f.icon} label={f.label} onClick={() => applyFilter(f.key)} />
                ))}
              </Box>
            )}

            {status === "idle" &&
              emptyState(
                <ManageSearchIcon />,
                "Search messages",
                <>
                  Type a phrase or add a filter above.
                  <br />
                  Use quotes for exact phrases, a minus to exclude words, or /regex/.
                </>
              )}

            {status === "loading" && (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <CircularProgress size={32} sx={{ color: t.primary }} />
              </Box>
            )}

            {status === "error" && emptyState(<SearchOffIcon />, "Search failed", "Try again in a moment.")}

            {status === "done" && hits.length === 0 &&
              emptyState(<SearchOffIcon />, "No results found", "Try different words or remove a filter.")}

            {status === "done" && hits.length > 0 && (
              <>
                <Box sx={{ display: "flex", alignItems: "center", px: 2.5, pt: 1, pb: 0.5 }}>
                  <Box sx={{ flex: 1, fontSize: "0.875rem", color: t.onSurfaceVariant }}>
                    {hits.length} {hits.length === 1 ? "result" : "results"}
                    {loadingMore ? "…" : ""}
                  </Box>
                  <ButtonBase
                    onClick={() => setSort(sort === "newest" ? "oldest" : "newest", context)}
                    sx={{
                      height: 40,
                      px: 1.5,
                      gap: 1,
                      borderRadius: "20px",
                      color: t.primary,
                      fontFamily: "inherit",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      "& .MuiSvgIcon-root": { fontSize: 18 },
                    }}
                  >
                    <SwapVertIcon />
                    {sort === "newest" ? "Newest first" : "Oldest first"}
                  </ButtonBase>
                </Box>

                {groups.map((group) => (
                  <Box key={group.dayKey} sx={{ px: 2 }}>
                    <Box
                      sx={{
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                        bgcolor: t.surface,
                        mx: -2,
                      }}
                    >
                      <M3Subheader>{group.dayLabel}</M3Subheader>
                    </Box>
                    <M3ListGroup>
                      {group.hits.map((hit, i) => (
                        <ButtonBase
                          key={`${hit.offset}-${hit.timestamp}`}
                          onClick={() => openHit(hit)}
                          sx={{
                            width: "100%",
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "flex-start",
                            textAlign: "left",
                            gap: 2,
                            px: 2,
                            py: 1.5,
                            fontFamily: "inherit",
                            borderBottom:
                              i < group.hits.length - 1 ? `1px solid ${t.outlineVariant}` : "none",
                          }}
                        >
                          <UserAvatar src="" name={hit.sender} className="h-10 w-10 shrink-0 md:h-10 md:w-10" />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                              <Box
                                sx={{
                                  flex: 1,
                                  minWidth: 0,
                                  fontSize: "1rem",
                                  lineHeight: "24px",
                                  color: t.onSurface,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {hit.sender}
                              </Box>
                              <Box sx={{ fontSize: "0.75rem", color: t.onSurfaceVariant, flexShrink: 0 }}>
                                {hit.timestamp.slice(11, 16)}
                              </Box>
                            </Box>
                            <Box
                              sx={{
                                fontSize: "0.875rem",
                                lineHeight: "20px",
                                letterSpacing: "0.25px",
                                color: t.onSurfaceVariant,
                                wordBreak: "break-word",
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                                "& mark": {
                                  backgroundColor: `${t.primaryContainer} !important`,
                                  color: `${t.onPrimaryContainer} !important`,
                                  borderRadius: "4px",
                                },
                              }}
                            >
                              <HighlightedContent
                                content={hit.content}
                                ranges={getHighlightRanges(hit.content, parsed)}
                              />
                            </Box>
                          </Box>
                        </ButtonBase>
                      ))}
                    </M3ListGroup>
                  </Box>
                ))}

                <Box sx={{ display: "flex", justifyContent: "center", py: 3, color: t.onSurfaceVariant, fontSize: "0.75rem" }}>
                  {loadingMore ? (
                    <CircularProgress size={20} sx={{ color: t.primary }} />
                  ) : (
                    `End of results (${hits.length} ${hits.length === 1 ? "message" : "messages"})`
                  )}
                </Box>
              </>
            )}
          </>
        )}
      </Box>
    </Box>
  );
};
