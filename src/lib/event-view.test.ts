import { describe, expect, it } from "vitest";
import { applyEventView, classifyEvent, type EventKind } from "@/lib/event-view";
import { linkHost, linkLooksSuspicious } from "@/lib/system-utils";

const sys = (id: string, content: string) => ({ id, content, isSystem: true });
const chat = (id: string, content: string) => ({ id, content, isSystem: false });
const all: Record<EventKind, boolean> = { join: true, part: true, quit: true, nick: true, kick: true };

describe("classifyEvent", () => {
  it("recognises event lines and ignores chat", () => {
    expect(classifyEvent(sys("1", "bob has joined"))).toBe("join");
    expect(classifyEvent(sys("1", "bob has quit (Ping timeout)"))).toBe("quit");
    expect(classifyEvent(sys("1", "bob is now known as rob"))).toBe("nick");
    expect(classifyEvent(chat("1", "bob has joined"))).toBeNull();
  });
});

describe("applyEventView", () => {
  const joins = [sys("1", "a has joined"), sys("2", "b has joined"), sys("3", "c has joined")];

  it("folds three events into one line that keeps the first id", () => {
    const out = applyEventView(joins, { show: all, group: true }, null);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("1");
  });

  it("does not fold two events", () => {
    expect(applyEventView(joins.slice(0, 2), { show: all, group: true }, null)).toHaveLength(2);
  });

  it("never folds or hides the message the unread marker points at", () => {
    expect(applyEventView(joins, { show: all, group: true }, "2")).toHaveLength(3);
    const hidden = applyEventView(joins, { show: { ...all, join: false }, group: true }, "2");
    expect(hidden.map((m) => m.id)).toEqual(["2"]);
  });

  it("hides a turned-off kind but keeps chat", () => {
    const out = applyEventView([...joins, chat("4", "hi")], { show: { ...all, join: false }, group: false }, null);
    expect(out.map((m) => m.id)).toEqual(["4"]);
  });
});

describe("links", () => {
  it("flags raw IPs and punycode hosts only", () => {
    expect(linkLooksSuspicious("http://192.168.0.1/x")).toBe(true);
    expect(linkLooksSuspicious("https://xn--pple-43d.com")).toBe(true);
    expect(linkLooksSuspicious("https://example.com")).toBe(false);
    expect(linkHost("mailto:a@b.c")).toBeNull();
  });
});
