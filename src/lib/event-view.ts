import i18n from "@/lib/i18n";
import type { Message } from "@/types";

/** The kinds of channel event lines the chat can hide or fold together. */
export type EventKind = "join" | "part" | "quit" | "nick" | "kick";

export const EVENT_KINDS: EventKind[] = ["join", "part", "quit", "nick", "kick"];

const GROUP_FROM = 3;
const SHOWN_NAMES = 3;

/** Recognises the system lines the backend writes for IRC events (the text is not translated). */
export function classifyEvent(message: Pick<Message, "content" | "isSystem">): EventKind | null {
  if (!message.isSystem) return null;
  const text = message.content;
  if (/ has joined$/.test(text)) return "join";
  if (/ has left(?: \(.*\))?$/.test(text)) return "part";
  if (/ has quit(?: \(.*\))?$/.test(text)) return "quit";
  if (/ is now known as \S+$/.test(text)) return "nick";
  if (/ was kicked (?:from|by) /.test(text)) return "kick";
  return null;
}

const firstWord = (text: string) => text.split(/\s+/)[0] ?? "";

function summarize(kinds: Map<EventKind, string[]>): string {
  const names = (list: string[]) =>
    list.length > SHOWN_NAMES ? `${list.slice(0, SHOWN_NAMES).join(", ")} +${list.length - SHOWN_NAMES}` : list.join(", ");
  return EVENT_KINDS.filter((kind) => kinds.has(kind))
    .map((kind) => i18n.t(`chat.events.${kind}`, { names: names([...new Set(kinds.get(kind))]) }))
    .join(" · ");
}

export interface EventViewSettings {
  show: Record<EventKind, boolean>;
  group: boolean;
}

/**
 * Hides the event kinds the user turned off and folds runs of three or more events into one line
 * ("alice, bob joined · carol left"). A folded line reuses the first message's id and offset, so
 * scrolling and pagination keep working; the message the unread marker points at is never hidden or folded.
 */
export function applyEventView<T extends Pick<Message, "id" | "content" | "isSystem">>(
  items: T[],
  settings: EventViewSettings,
  protectedId: string | null
): T[] {
  const visible = items.filter((item) => {
    const kind = classifyEvent(item);
    return !kind || settings.show[kind] || item.id === protectedId;
  });
  if (!settings.group) return visible;

  const out: T[] = [];
  let run: { item: T; kind: EventKind }[] = [];
  const flush = () => {
    if (run.length >= GROUP_FROM && !run.some((entry) => entry.item.id === protectedId)) {
      const kinds = new Map<EventKind, string[]>();
      for (const { item, kind } of run) {
        const who = kind === "nick" ? `${firstWord(item.content)} → ${item.content.split(/\s+/).pop()}` : firstWord(item.content);
        kinds.set(kind, [...(kinds.get(kind) ?? []), who]);
      }
      out.push({ ...run[0].item, content: summarize(kinds) });
    } else {
      out.push(...run.map((entry) => entry.item));
    }
    run = [];
  };
  for (const item of visible) {
    const kind = classifyEvent(item);
    if (kind) run.push({ item, kind });
    else {
      flush();
      out.push(item);
    }
  }
  flush();
  return out;
}
