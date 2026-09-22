import { useEffect, useLayoutEffect, useRef, useCallback, useMemo, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { format } from "date-fns";
import { ArrowDownToLine, Loader2, ServerCrash } from "lucide-react";
import { Member, Message, DirectMessage } from "@/types";

import { useChatQuery } from "@/hooks/use-chat-query";
import { useChatSocket } from "@/hooks/use-chat-socket";
import { useMockStore, formatMessageDate } from "@/lib/mock-store";
import { useSearchStore } from "@/hooks/use-search-store";
import { cn } from "@/lib/utils";

import { ChatWelcome } from "./chat-welcome";
import { ChatItem } from "./chat-item";
import { NewMessagesDivider } from "./new-messages-divider";
import { clearProxyCache } from "./smart-image";

const DATE_FORMAT = "d MMM yyyy, HH:mm";
const TIME_FORMAT = "HH:mm";
const HISTORY_EDGE_TRIGGER_PX = 600;
const HISTORY_LOAD_COOLDOWN_MS = 100;
// Hysteresis for the "at bottom" state (unread-counter safety): entering the
// bottom zone requires getting within 10px, leaving requires exceeding 60px,
// so touchpad jitter around a single threshold cannot wipe the unread counter.
const BOTTOM_ENTER_THRESHOLD_PX = 10;
const BOTTOM_EXIT_THRESHOLD_PX = 60;
// Deliberate upward-wheel amount required to detach from the bottom. Filters
// single-event trackpad noise (natural-scrolling reversal, diagonal swipes,
// tilt-wheel ticks) that popped the "Jump to latest" pill without any real
// scroll movement.
const WHEEL_UNSTICK_DELTA_PX = 24;
const WHEEL_GESTURE_GAP_MS = 400;

interface ChatMessagesProps {
  name: string;
  member: Member;
  chatId: string;
  serverId: string;
  paramKey: "channelId" | "conversationId";
  paramValue: string;
  type: "channel" | "conversation";
}

export const ChatMessages = ({
  name,
  member,
  chatId,
  serverId,
  paramKey,
  paramValue,
  type,
}: ChatMessagesProps) => {
  const queryKey = `chat:${chatId}`;
  const addKey = `chat:${chatId}:messages`;
  const updateKey = `chat:${chatId}:messages:update`;
  const chatRef = useRef<HTMLDivElement>(null);
  const rowElementsRef = useRef(new Map<string, HTMLDivElement>());
  const shouldStickToBottomRef = useRef(true);
  const hasInitializedRef = useRef(false);
  const isLoadingOlderRef = useRef(false);
  const isLoadingNewerRef = useRef(false);
  const lastOlderLoadTimeRef = useRef(0);
  const lastNewerLoadTimeRef = useRef(0);
  const programmaticScrollUntilRef = useRef(0);
  const jumpingToLatestRef = useRef(false);
  const lastScrollTopRef = useRef(0);
  const wheelUpAccumRef = useRef(0);
  const lastWheelUpTimeRef = useRef(0);
  const anchorRef = useRef<{
    id: string;
    screenY: number;
    scrollHeight: number;
    scrollTop: number;
    itemsCount: number;
    firstItemId?: string;
    lastItemId?: string;
    reason: string;
  } | null>(null);
  const remeasureCallbacksRef = useRef(new Map<string, () => void>());
  const layoutFrameRef = useRef<number | null>(null);
  const loadChatHistory = useMockStore((state) => state.loadChatHistory);
  const loadOlderHistory = useMockStore((state) => state.loadOlderHistory);
  const loadNewerHistory = useMockStore((state) => state.loadNewerHistory);
  const jumpToLatest = useMockStore((state) => state.jumpToLatest);
  const clearHistoryLoading = useMockStore((state) => state.clearHistoryLoading);
  const markTailSeen = useMockStore((state) => state.markTailSeen);
  const clearUnreadMarker = useMockStore((state) => state.clearUnreadMarker);
  const setTailPinned = useMockStore((state) => state.setTailPinned);
  const unreadCount = useMockStore((state) => state.historyWindow.unreadCount);
  const firstUnreadMessageId = useMockStore((state) => state.historyWindow.firstUnreadMessageId);
  const historyWindowKey = useMockStore((state) => state.historyWindow.key);
  const currentChatKey = `${type}:${chatId}`;
  const windowReady = useMockStore((state) => state.historyWindow.ready);
  const hasOlder = useMockStore((state) => state.historyWindow.hasOlder);
  const olderCursor = useMockStore((state) => state.historyWindow.olderCursor);
  const hasNewer = useMockStore((state) => state.historyWindow.hasNewer);
  const newerCursor = useMockStore((state) => state.historyWindow.newerCursor);
  const loadingOlder = useMockStore((state) => state.historyWindow.loadingOlder);
  const loadingNewer = useMockStore((state) => state.historyWindow.loadingNewer);
  const pendingLiveCount = useMockStore((state) => state.historyWindow.pendingLive.length);
  const dateFormatPreset = useMockStore((state) => state.dateFormatPreset) || "d MMM yyyy, HH:mm";
  const customDateFormat = useMockStore((state) => state.customDateFormat) || "yyyy/MM/dd HH:mm";
  const [atBottom, setAtBottom] = useState(true);

  // Search jump-to-message: pending target queued by the search results panel.
  const pendingJumpMessageId = useSearchStore((state) => state.pendingJumpMessageId);
  const clearPendingJump = useSearchStore((state) => state.clearPendingJump);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  const {
    data,
    status,
  } = useChatQuery({
    queryKey,
    paramKey,
    paramValue,
  });
  useChatSocket({ queryKey, addKey, updateKey });

  const items = useMemo(() => data?.pages.flatMap((page) => page.items as Message[]) || [], [data?.pages]);
  const historyTarget = type === "channel" && !name.startsWith("#") ? `#${name}` : name;
  const hasWelcome = windowReady && !hasOlder && olderCursor === null;
  const totalCount = items.length + (hasWelcome ? 1 : 0);

  useEffect(() => {
    if (!hasInitializedRef.current) return;
    if (!(atBottom && !hasNewer && items.length > 0)) return;
    // Directional guard (Fix A): while the viewport is still moving away from
    // the bottom, freshly arrived messages must remain unread instead of being
    // silently stamped as seen by the at-bottom watcher.
    const element = chatRef.current;
    if (element && element.scrollTop < lastScrollTopRef.current - 1) return;
    if (typeof document !== "undefined" && !document.hasFocus()) return;
    markTailSeen(items[items.length - 1].id);
  }, [items, atBottom, hasNewer, markTailSeen, chatId]);

  useEffect(() => {
    const handleFocus = () => {
      if (atBottom && !hasNewer && items.length > 0) {
        markTailSeen(items[items.length - 1].id);
      }
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [atBottom, hasNewer, items, markTailSeen]);

  // Unread counter (Model v2): event-driven, stored in historyWindow.unreadCount.
  // Arrivals while away-from-bottom increment it inside addMessage/addDirectMessage;
  // genuine "seen" stamps below zero it. Window trimming/chunk loads never touch it,
  // so long inactivity cannot freeze it and chunk moves cannot reset it.
  const showJumpToLatest = (items.length > 0 && !atBottom) || hasNewer || pendingLiveCount > 0;

  const virtualizer = useVirtualizer({
    count: totalCount,
    getScrollElement: () => chatRef.current,
    getItemKey: (index) => {
      if (hasWelcome && index === 0) return "__welcome__";
      const msgIndex = hasWelcome ? index - 1 : index;
      const msg = items[msgIndex];
      return msg?.id ?? index;
    },
    estimateSize: (index) => {
      if (hasWelcome && index === 0) return 160;
      const msgIndex = hasWelcome ? index - 1 : index;
      const msg = items[msgIndex];
      if (!msg) return 48;
      if (msg.isSystem) return 28;
      const isFirstUnread = firstUnreadMessageId !== null && msg.id === firstUnreadMessageId;
      const extraHeight = isFirstUnread ? 28 : 0;
      if (msg.fileUrl) return 260 + extraHeight;
      const content = msg.content || "";
      if (/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=))/i.test(content)) return 280 + extraHeight;
      if (/(?:https?:\/\/[^\s]+\.(?:png|jpg|jpeg|gif|webp|mp4|webm|mov|ogg))/i.test(content)) return 260 + extraHeight;
      if (/https?:\/\/[^\s]+/i.test(content)) return 140 + extraHeight;

      const prev = items[msgIndex - 1];
      const isSameAuthor = Boolean(
        prev &&
          (prev.member?.id === msg.member?.id ||
            (prev.member?.profile?.name &&
              msg.member?.profile?.name &&
              prev.member.profile.name.toLowerCase() === msg.member.profile.name.toLowerCase()))
      );
      const isWithin5Min = prev && (new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 300000);
      const isCompact = Boolean(!isFirstUnread && isSameAuthor && isWithin5Min && !prev.deleted && !prev.isSystem && !msg.isSystem);

      if (content.length > 200 || content.includes("\n")) {
        const lineCount = (content.match(/\n/g) || []).length + 1;
        return (isCompact ? Math.min(24 + lineCount * 20, 200) : Math.min(48 + lineCount * 20, 240)) + extraHeight;
      }
      return (isCompact ? 24 : 48) + extraHeight;
    },
    overscan: 20,
    useAnimationFrameWithResizeObserver: true,
  });

  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = (item, delta, instance) => {
    if (shouldStickToBottomRef.current) return false;
    const firstVisible = instance.getVirtualItems()[0];
    if (!firstVisible) return false;
    return item.index < firstVisible.index;
  };

  const markProgrammaticScroll = useCallback((durationMs = 160) => {
    programmaticScrollUntilRef.current = Math.max(
      programmaticScrollUntilRef.current,
      performance.now() + durationMs,
    );
  }, []);

  const pinToBottom = useCallback((behavior: "auto" | "smooth" = "auto", _reason = "default") => {
    const element = chatRef.current;
    if (!element) return;
    markProgrammaticScroll(150);
    element.scrollTop = element.scrollHeight;
  }, [markProgrammaticScroll]);

  const registerRowElement = useCallback((element: HTMLDivElement | null, id: string) => {
    if (element) {
      rowElementsRef.current.set(id, element);
      virtualizer.measureElement(element);
    } else {
      rowElementsRef.current.delete(id);
    }
  }, [virtualizer]);

  const captureAnchor = useCallback((reason = "manual") => {
    const element = chatRef.current;
    if (!element || shouldStickToBottomRef.current || items.length === 0) return;
    const containerRect = element.getBoundingClientRect();
    const paddingTop = parseFloat(getComputedStyle(element).paddingTop) || 0;
    let found = false;
    for (const msg of items) {
      const rowEl = rowElementsRef.current.get(msg.id);
      if (rowEl) {
        const rect = rowEl.getBoundingClientRect();
        if (rect.bottom > containerRect.top + paddingTop + 2) {
          anchorRef.current = {
            id: msg.id,
            screenY: rect.top - containerRect.top - paddingTop,
            scrollHeight: element.scrollHeight,
            scrollTop: element.scrollTop,
            itemsCount: items.length,
            firstItemId: items[0]?.id,
            lastItemId: items[items.length - 1]?.id,
            reason,
          };
          found = true;
          break;
        }
      }
    }
    if (!found && items.length > 0) {
      const firstMsg = items[0];
      anchorRef.current = {
        id: firstMsg.id,
        screenY: 0,
        scrollHeight: element.scrollHeight,
        scrollTop: element.scrollTop,
        itemsCount: items.length,
        firstItemId: items[0]?.id,
        lastItemId: items[items.length - 1]?.id,
        reason,
      };
    }
  }, [items]);

  const triggerLoadOlder = useCallback(() => {
    const element = chatRef.current;
    if (
      !element
      || hasOlder === false
      || olderCursor === null
      || isLoadingOlderRef.current
      || items.length === 0
    ) {
      return;
    }

    const now = performance.now();
    if (now - lastOlderLoadTimeRef.current < HISTORY_LOAD_COOLDOWN_MS) {
      return;
    }

    isLoadingOlderRef.current = true;
    lastOlderLoadTimeRef.current = now;
    captureAnchor("triggerLoadOlder");

    const fallbackTimer = setTimeout(() => {
      isLoadingOlderRef.current = false;
      lastOlderLoadTimeRef.current = performance.now();
      clearHistoryLoading();
    }, 5000);

    void loadOlderHistory(type, chatId, serverId, historyTarget).then((loaded: boolean) => {
      clearTimeout(fallbackTimer);
      isLoadingOlderRef.current = false;
      lastOlderLoadTimeRef.current = performance.now();
      if (!loaded) {
        anchorRef.current = null;
      }
    });
  }, [hasOlder, olderCursor, items.length, loadOlderHistory, clearHistoryLoading, type, chatId, serverId, historyTarget, captureAnchor]);

  const triggerLoadNewer = useCallback(() => {
    const element = chatRef.current;
    if (
      !element
      || hasNewer === false
      || newerCursor === null
      || isLoadingNewerRef.current
    ) {
      return;
    }

    const now = performance.now();
    if (now - lastNewerLoadTimeRef.current < HISTORY_LOAD_COOLDOWN_MS) {
      return;
    }

    isLoadingNewerRef.current = true;
    lastNewerLoadTimeRef.current = now;
    if (!shouldStickToBottomRef.current) {
      captureAnchor("triggerLoadNewer");
    }

    const fallbackTimer = setTimeout(() => {
      isLoadingNewerRef.current = false;
      lastNewerLoadTimeRef.current = performance.now();
      clearHistoryLoading();
    }, 5000);

    void loadNewerHistory(type, chatId, serverId, historyTarget).then((loaded: boolean) => {
      clearTimeout(fallbackTimer);
      isLoadingNewerRef.current = false;
      lastNewerLoadTimeRef.current = performance.now();
      if (!loaded) {
        anchorRef.current = null;
      }
    });
  }, [hasNewer, newerCursor, loadNewerHistory, clearHistoryLoading, type, chatId, serverId, historyTarget, captureAnchor]);

  const handleChatScroll = useCallback(() => {
    const element = chatRef.current;
    if (!element) return;

    if (jumpingToLatestRef.current) {
      shouldStickToBottomRef.current = true;
      setAtBottom(true);
      return;
    }

    const scrollTop = element.scrollTop;
    const canScroll = element.scrollHeight > element.clientHeight + 5;
    const distanceFromBottom = element.scrollHeight - scrollTop - element.clientHeight;

    // Direction tracking runs on EVERY event (programmatic ones included) so the
    // seen-stamp here and the at-bottom watcher effect can tell "leaving the
    // bottom" apart from "sitting at / returning to the bottom".
    const movingUp = scrollTop < lastScrollTopRef.current - 1;
    lastScrollTopRef.current = scrollTop;

    // Programmatic scrolls (anchor restore, pin-to-bottom) are position-neutral:
    // estimated row sizes can transiently land them inside the bottom grace zone,
    // which must never flip the at-bottom state nor mark messages as seen (Fix B).
    const isProgrammatic = performance.now() < programmaticScrollUntilRef.current;

    // Hysteresis (Fix C): enter the bottom state below 10px, leave it above 60px.
    const prevAtBottom = shouldStickToBottomRef.current;
    const isAtBottom = isProgrammatic
      ? prevAtBottom
      : prevAtBottom
        ? !hasNewer && (!canScroll || distanceFromBottom < BOTTOM_EXIT_THRESHOLD_PX)
        : !hasNewer && !movingUp && (!canScroll || distanceFromBottom < BOTTOM_ENTER_THRESHOLD_PX);

    if (prevAtBottom !== isAtBottom) {
      setTailPinned(isAtBottom);
    }
    shouldStickToBottomRef.current = isAtBottom;
    setAtBottom((prev) => (prev === isAtBottom ? prev : isAtBottom));

    if (isAtBottom) {
      anchorRef.current = null;
      // Never stamp messages as seen while scrolling AWAY from the bottom (Fix A):
      // slow upward scrolling passes through the grace zone over many events and
      // used to wipe the unread counter.
      if (!movingUp && items.length > 0) {
        if (typeof document !== "undefined" && !document.hasFocus()) {
          // Do not mark seen if unfocused!
        } else {
          markTailSeen(items[items.length - 1].id);
        }
        // Fresh baseline: pending upward-wheel intent must not survive into the
        // next gesture once the user is genuinely back at the bottom.
        wheelUpAccumRef.current = 0;
      }
    }

    if (canScroll) {
      if (scrollTop <= HISTORY_EDGE_TRIGGER_PX) {
        triggerLoadOlder();
      } else if (distanceFromBottom <= HISTORY_EDGE_TRIGGER_PX) {
        triggerLoadNewer();
      }
    }
  }, [triggerLoadOlder, triggerLoadNewer, items, hasNewer, markTailSeen, setTailPinned]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const element = chatRef.current;
    if (!element) return;

    // Normalize line/page wheel modes to pixels so the noise gate behaves the
    // same across devices.
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaMode === 2 ? e.deltaY * 100 : e.deltaY;

    // Horizontal-dominant gestures (tilt wheel, diagonal trackpad swipes) must
    // not touch the vertical follow/unread logic at all.
    if (Math.abs(e.deltaX) > Math.abs(dy)) return;

    const canScroll = element.scrollHeight > element.clientHeight + 5;
    const wasSticking = shouldStickToBottomRef.current;

    // Accumulate upward intent: a single tiny negative deltaY (trackpad jitter,
    // natural-scrolling reversal on "down" gestures) must not detach the tail —
    // only a deliberate sustained upward amount does. Downward deltas cancel it.
    if (dy < 0) {
      const now = performance.now();
      if (now - lastWheelUpTimeRef.current > WHEEL_GESTURE_GAP_MS) {
        wheelUpAccumRef.current = 0;
      }
      lastWheelUpTimeRef.current = now;
      wheelUpAccumRef.current += dy;
    } else {
      wheelUpAccumRef.current = Math.min(0, wheelUpAccumRef.current + dy);
    }

    if (dy < 0 && wasSticking && canScroll && wheelUpAccumRef.current <= -WHEEL_UNSTICK_DELTA_PX) {
      wheelUpAccumRef.current = 0;
      shouldStickToBottomRef.current = false;
      setTailPinned(false);
      setAtBottom(false);
      jumpingToLatestRef.current = false;
      programmaticScrollUntilRef.current = 0;
    }

    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight;

    if (canScroll) {
      if (dy < 0 && element.scrollTop <= HISTORY_EDGE_TRIGGER_PX) {
        triggerLoadOlder();
      } else if (dy > 0 && distanceFromBottom <= HISTORY_EDGE_TRIGGER_PX) {
        triggerLoadNewer();
      }
    }
  }, [triggerLoadOlder, triggerLoadNewer, setTailPinned]);

  useEffect(() => {
    hasInitializedRef.current = false;
    shouldStickToBottomRef.current = true;
    isLoadingOlderRef.current = false;
    isLoadingNewerRef.current = false;
    anchorRef.current = null;
    lastScrollTopRef.current = 0;
    rowElementsRef.current.clear();
    remeasureCallbacksRef.current.clear();
    setAtBottom(true);
    clearProxyCache();
    void loadChatHistory(
      type,
      chatId,
      serverId,
      historyTarget,
    );
  }, [chatId, historyTarget, loadChatHistory, serverId, type]);

  useLayoutEffect(() => {
    const element = chatRef.current;
    if (!element) return;

    const canScroll = element.scrollHeight > element.clientHeight + 5;
    if (!canScroll && !hasNewer) {
      const wasSticking = shouldStickToBottomRef.current;
      shouldStickToBottomRef.current = true;
      setAtBottom(true);
      if (!wasSticking) setTailPinned(true);
    }

    if (shouldStickToBottomRef.current && totalCount > 0) {
      if (typeof document !== "undefined" && !document.hasFocus()) {
        shouldStickToBottomRef.current = false;
        setAtBottom(false);
        setTailPinned(false);
        return;
      }
      pinToBottom("auto", "useLayoutEffect (stickToBottom)");
      anchorRef.current = null;
      return;
    }

    if (!anchorRef.current) return;

    const anchor = anchorRef.current;
    anchorRef.current = null;

    const anchorIndex = items.findIndex((m) => m.id === anchor.id);
    if (anchorIndex !== -1) {
      const virtualIndex = anchorIndex + (hasWelcome ? 1 : 0);
      const [targetOffset] = virtualizer.getOffsetForIndex(virtualIndex, "start") ?? [];
      if (typeof targetOffset === "number" && !isNaN(targetOffset)) {
        const targetScrollTop = Math.max(0, targetOffset - anchor.screenY);
        markProgrammaticScroll(150);
        element.scrollTop = targetScrollTop;
        return;
      }
    }

    const currentScrollHeight = element.scrollHeight;
    const scrollHeightDelta = currentScrollHeight - anchor.scrollHeight;
    if (scrollHeightDelta > 0) {
      const targetScrollTop = element.scrollTop + scrollHeightDelta;
      markProgrammaticScroll(150);
      element.scrollTop = targetScrollTop;
    }
  }, [items, totalCount, pinToBottom, markProgrammaticScroll, hasNewer, hasWelcome, virtualizer]);

  useEffect(() => {
    if (totalCount === 0 || !windowReady || historyWindowKey !== currentChatKey) return;

    if (!hasInitializedRef.current) {
      const unreadId =
        firstUnreadMessageId ||
        useMockStore.getState().historyWindow.firstUnreadMessageId;

      if (unreadId) {
        const currentItems = (
          useMockStore.getState().messages[chatId] ||
          useMockStore.getState().directMessages[chatId] ||
          []
        ) as (Message | DirectMessage)[];
        const messageIndex = currentItems.findIndex((m) => m.id === unreadId);

        if (messageIndex !== -1) {
          const virtualIndex = messageIndex + (hasWelcome ? 1 : 0);
          shouldStickToBottomRef.current = false;
          setTailPinned(false);
          setAtBottom(false);
          markProgrammaticScroll(600);
          virtualizer.scrollToIndex(virtualIndex, { align: "start" });

          const raf = requestAnimationFrame(() => {
            markProgrammaticScroll(600);
            virtualizer.scrollToIndex(virtualIndex, { align: "start" });
            if (chatRef.current) {
              chatRef.current.scrollTop = Math.max(0, chatRef.current.scrollTop - 40);
            }
            hasInitializedRef.current = true;
          });
          return () => cancelAnimationFrame(raf);
        }
      }

      // No unread messages -> pin to bottom
      pinToBottom("auto", "initialMount");
      hasInitializedRef.current = true;
    }
  }, [totalCount, windowReady, historyWindowKey, currentChatKey, pinToBottom, firstUnreadMessageId, chatId, hasWelcome, virtualizer, markProgrammaticScroll]);

  useEffect(() => {
    if (totalCount === 0) return;

    const refreshLayout = (e: Event) => {
      if (!shouldStickToBottomRef.current) return;

      if (layoutFrameRef.current !== null) {
        cancelAnimationFrame(layoutFrameRef.current);
      }
      layoutFrameRef.current = requestAnimationFrame(() => {
        layoutFrameRef.current = null;
        pinToBottom("auto", `windowEvent (${e.type})`);
      });
    };

    window.addEventListener("focus", refreshLayout);
    window.addEventListener("resize", refreshLayout);
    document.addEventListener("visibilitychange", refreshLayout);

    return () => {
      window.removeEventListener("focus", refreshLayout);
      window.removeEventListener("resize", refreshLayout);
      document.removeEventListener("visibilitychange", refreshLayout);
      if (layoutFrameRef.current !== null) {
        cancelAnimationFrame(layoutFrameRef.current);
        layoutFrameRef.current = null;
      }
    };
  }, [totalCount, pinToBottom]);

  const getRemeasureCallback = useCallback((messageId: string) => {
    let cb = remeasureCallbacksRef.current.get(messageId);
    if (!cb) {
      cb = () => {
        const element = rowElementsRef.current.get(messageId);
        if (!element) return;

        if (shouldStickToBottomRef.current) {
          virtualizer.measureElement(element);
          pinToBottom("auto", `remeasure on ${messageId}`);
          return;
        }

        virtualizer.measureElement(element);
      };
      remeasureCallbacksRef.current.set(messageId, cb);
    }
    return cb;
  }, [pinToBottom, virtualizer]);

  const handleJumpToLatest = useCallback(() => {
    jumpingToLatestRef.current = true;
    markProgrammaticScroll(200);
    shouldStickToBottomRef.current = true;
    anchorRef.current = null;
    setAtBottom(true);
    setTailPinned(true);

    if (items.length > 0) {
      markTailSeen(items[items.length - 1].id);
    }

    void jumpToLatest(type, chatId, serverId, historyTarget).then(() => {
      shouldStickToBottomRef.current = true;
      anchorRef.current = null;
      pinToBottom("auto", "handleJumpToLatest post-load");
      requestAnimationFrame(() => {
        pinToBottom("auto", "handleJumpToLatest raf");
        jumpingToLatestRef.current = false;
      });
    });
  }, [items, jumpToLatest, type, chatId, serverId, historyTarget, pinToBottom, markTailSeen, setTailPinned, markProgrammaticScroll]);

  const handleJumpToUnread = useCallback(() => {
    const unreadId = firstUnreadMessageId || useMockStore.getState().historyWindow.firstUnreadMessageId;
    if (!unreadId) {
      handleJumpToLatest();
      return;
    }

    const scrollToUnread = (targetId: string) => {
      const currentItems = (
        (type === "channel"
          ? useMockStore.getState().messages[chatId]
          : useMockStore.getState().directMessages[chatId]) || []
      ) as (Message | DirectMessage)[];
      const messageIndex = currentItems.findIndex((m) => m.id === targetId);
      if (messageIndex !== -1) {
        const virtualIndex = messageIndex + (hasWelcome ? 1 : 0);
        shouldStickToBottomRef.current = false;
        setTailPinned(false);
        setAtBottom(false);
        anchorRef.current = null;
        markProgrammaticScroll(400);
        virtualizer.scrollToIndex(virtualIndex, { align: "start" });
        requestAnimationFrame(() => {
          markProgrammaticScroll(400);
          virtualizer.scrollToIndex(virtualIndex, { align: "start" });
          if (chatRef.current) {
            chatRef.current.scrollTop = Math.max(0, chatRef.current.scrollTop - 48);
          }
        });

        setHighlightedMessageId(targetId);
        if (highlightTimeoutRef.current !== null) {
          window.clearTimeout(highlightTimeoutRef.current);
        }
        highlightTimeoutRef.current = window.setTimeout(() => {
          setHighlightedMessageId(null);
        }, 2200);
      }
    };

    const messageIndex = items.findIndex((m) => m.id === unreadId);
    if (messageIndex !== -1) {
      scrollToUnread(unreadId);
    } else {
      void jumpToLatest(type, chatId, serverId, historyTarget).then(() => {
        setTimeout(() => {
          const freshId = useMockStore.getState().historyWindow.firstUnreadMessageId || unreadId;
          scrollToUnread(freshId);
        }, 50);
      });
    }
  }, [firstUnreadMessageId, items, hasWelcome, virtualizer, markProgrammaticScroll, setTailPinned, type, chatId, serverId, historyTarget, jumpToLatest, handleJumpToLatest]);

  const handleMarkAsRead = useCallback(() => {
    const lastMsgId = items.length > 0 ? items[items.length - 1].id : null;
    markTailSeen(lastMsgId);
    clearUnreadMarker();
  }, [items, markTailSeen, clearUnreadMarker]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.shiftKey && e.altKey && e.key === "ArrowUp") {
        e.preventDefault();
        handleJumpToUnread();
      } else if (e.shiftKey && e.key === "PageDown") {
        e.preventDefault();
        handleJumpToLatest();
      } else if (e.key === "End") {
        e.preventDefault();
        handleJumpToLatest();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleMarkAsRead();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleJumpToUnread, handleJumpToLatest, handleMarkAsRead]);

  // ── Search jump-to-message (Discord-style) ──────────────────────────────
  // When the search panel queues a hit, scroll the virtualizer to it (with a
  // few rAF retries until the jumped window actually renders the row), detach
  // from the bottom so autoscroll does not fight the jump, and flash-highlight
  // the row for ~2s.
  useEffect(() => {
    if (!pendingJumpMessageId) return;

    let rafId: number | null = null;
    let attempts = 0;
    let cancelled = false;

    const tryScroll = () => {
      if (cancelled) return;
      const messageIndex = items.findIndex((m) => m.id === pendingJumpMessageId);
      if (messageIndex === -1) {
        attempts += 1;
        if (attempts <= 20) {
          rafId = requestAnimationFrame(tryScroll);
        } else {
          clearPendingJump();
        }
        return;
      }

      const virtualIndex = messageIndex + (hasWelcome ? 1 : 0);
      shouldStickToBottomRef.current = false;
      setTailPinned(false);
      setAtBottom(false);
      anchorRef.current = null;
      markProgrammaticScroll(400);
      virtualizer.scrollToIndex(virtualIndex, { align: "center" });
      // Second pass after layout settles (dynamic row heights around the target).
      requestAnimationFrame(() => {
        if (cancelled) return;
        markProgrammaticScroll(400);
        virtualizer.scrollToIndex(virtualIndex, { align: "center" });
      });

      setHighlightedMessageId(pendingJumpMessageId);
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2200);

      clearPendingJump();
    };

    tryScroll();
    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [pendingJumpMessageId, items, hasWelcome, virtualizer, clearPendingJump, markProgrammaticScroll, setTailPinned]);

  useEffect(() => () => {
    if (highlightTimeoutRef.current !== null) {
      window.clearTimeout(highlightTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const handleFocusMessage = (event: Event) => {
      const messageId = (event as CustomEvent<{ messageId?: string }>).detail?.messageId;
      if (!messageId) return;

      const messageIndex = items.findIndex((message) => message.id === messageId);
      if (messageIndex < 0) return;

      const virtualIndex = messageIndex + (hasWelcome ? 1 : 0);
      shouldStickToBottomRef.current = false;
      setTailPinned(false);
      setAtBottom(false);
      markProgrammaticScroll(400);
      virtualizer.scrollToIndex(virtualIndex, { align: "center" });
      requestAnimationFrame(() => {
        markProgrammaticScroll(400);
        virtualizer.scrollToIndex(virtualIndex, { align: "center" });
      });

      setHighlightedMessageId(messageId);
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedMessageId(null);
      }, 2200);
    };

    window.addEventListener("focus_chat_message", handleFocusMessage);
    return () => window.removeEventListener("focus_chat_message", handleFocusMessage);
  }, [items, hasWelcome, virtualizer, markProgrammaticScroll, setTailPinned]);

  if (status === "loading") {
    return (
      <div className="flex flex-col flex-1 justify-center items-center">
        <Loader2 className="h-7 w-7 text-zinc-500 animate-spin my-4" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Loading messages...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-col flex-1 justify-center items-center">
        <ServerCrash className="h-7 w-7 text-zinc-500 my-4" />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Something went wrong!</p>
      </div>
    );
  }

  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        ref={chatRef}
        onScroll={handleChatScroll}
        onWheel={handleWheel}
        className="flex-1 min-h-0 flex flex-col py-4 overflow-y-auto overflow-x-hidden discord-scrollbar-chat"
      >
        <div
          className="relative w-full shrink-0"
          style={{ height: `${virtualizer.getTotalSize()}px` }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            if (hasWelcome && virtualRow.index === 0) {
              return (
                <div
                  key="__welcome__"
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                  <ChatWelcome type={type} name={name} />
                </div>
              );
            }

            const messageIndex = hasWelcome ? virtualRow.index - 1 : virtualRow.index;
            const message = items[messageIndex];
            if (!message) return null;

            const prevMessage = items[messageIndex - 1];
            const isSameAuthor = Boolean(
              prevMessage &&
                (prevMessage.member?.id === message.member?.id ||
                  (prevMessage.member?.profile?.name &&
                    message.member?.profile?.name &&
                    prevMessage.member.profile.name.toLowerCase() === message.member.profile.name.toLowerCase()))
            );
            const isWithinTimeLimit = prevMessage
              && new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() < 300000;
            const isFirstUnread = firstUnreadMessageId !== null && message.id === firstUnreadMessageId;
            const isCompact = Boolean(
              !isFirstUnread
              && isSameAuthor
              && isWithinTimeLimit
              && !prevMessage.deleted
              && !message.fileUrl
              && !prevMessage.isSystem
              && !message.isSystem,
            );

            return (
              <div
                key={message.id}
                data-index={virtualRow.index}
                ref={(element) => registerRowElement(element, message.id)}
                className={cn(
                  "absolute left-0 top-0 w-full flow-root rounded-md transition-colors",
                  highlightedMessageId === message.id && "search-highlight-flash"
                )}
                style={{ transform: `translateY(${virtualRow.start}px)` }}
              >
                {isFirstUnread && <NewMessagesDivider />}
                <ChatItem
                  id={message.id}
                  currentMember={member}
                  member={message.member}
                  content={message.content}
                  fileUrl={message.fileUrl || null}
                  deleted={message.deleted}
                  timestamp={formatMessageDate(message.createdAt, dateFormatPreset, customDateFormat)}
                  compactTime={format(new Date(message.createdAt), TIME_FORMAT)}
                  channelId={paramKey === "channelId" ? paramValue : undefined}
                  conversationId={paramKey === "conversationId" ? paramValue : undefined}
                  compact={isCompact}
                  isSystem={message.isSystem}
                  ircMsgid={message.ircMsgid}
                  messageOffset={message.offset}
                  replyTo={message.replyTo}
                  onContentSizeChange={getRemeasureCallback(message.id)}
                />
              </div>
            );
          })}
        </div>
      </div>

      {loadingOlder && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full bg-black/70 dark:bg-black/60 text-white text-xs px-3 py-1.5 pointer-events-none">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading older...
        </div>
      )}

      {loadingNewer && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full bg-black/70 dark:bg-black/60 text-white text-xs px-3 py-1.5 pointer-events-none">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading newer...
        </div>
      )}

      {showJumpToLatest && (
        <button
          onClick={handleJumpToLatest}
          className="absolute bottom-4 right-4 z-10 flex items-center gap-2 rounded-full bg-[#5865F2] hover:bg-[#4752C4] text-white text-xs font-semibold px-3 py-2 shadow-lg transition-all transform active:scale-95 cursor-pointer animate-in fade-in slide-in-from-bottom-2 duration-150"
        >
          <ArrowDownToLine className="h-4 w-4" />
          <span>Jump to latest</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold leading-none">
              {unreadCount}
            </span>
          )}
        </button>
      )}
    </div>
  );
};