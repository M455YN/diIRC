import { describe, expect, it } from "vitest";
import { cleanDialog } from "./dialog";

describe("cleanDialog", () => {
  it("gives an empty request a title and a single OK button", () => {
    const dialog = cleanDialog({});
    expect(dialog.title).toBe("Extension");
    expect(dialog.buttons).toEqual([{ id: "ok", label: "OK", primary: true }]);
    expect(dialog.fields).toEqual([]);
  });

  it("only keeps http(s) links, so an extension cannot make the app show a script or file URL as a link", () => {
    expect(cleanDialog({ link: "https://example.org/x" }).link).toBe("https://example.org/x");
    expect(cleanDialog({ link: "javascript:alert(1)" }).link).toBeUndefined();
    expect(cleanDialog({ link: "file:///C:/secret" }).link).toBeUndefined();
  });

  it("rejects a field with a name that is not an identifier", () => {
    expect(() => cleanDialog({ fields: [{ name: "../x" }] })).toThrow();
    expect(() => cleanDialog({ fields: [{ name: "" }] })).toThrow();
  });

  it("limits how much an extension can put on screen", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ name: `f${i}`, id: `b${i}` }));
    const dialog = cleanDialog({ title: "t".repeat(500), text: "x".repeat(10_000), fields: many, buttons: many });
    expect(dialog.title.length).toBe(100);
    expect(dialog.text?.length).toBe(4000);
    expect(dialog.fields).toHaveLength(5);
    expect(dialog.buttons).toHaveLength(4);
  });

  it("accepts a one-line sendText and refuses one that could not go out as a chat line", () => {
    expect(cleanDialog({ sendText: "https://example.org/a" }).sendText).toBe("https://example.org/a");
    expect(cleanDialog({}).sendText).toBeUndefined();
    expect(cleanDialog({ sendText: 5 }).sendText).toBeUndefined();
    expect(() => cleanDialog({ sendText: "two\nlines" })).toThrow();
    expect(() => cleanDialog({ sendText: "x".repeat(401) })).toThrow();
    expect(cleanDialog({ sendText: "x".repeat(400) }).sendText).toHaveLength(400);
  });

  it("treats anything that is not a string as empty", () => {
    const dialog = cleanDialog({ title: 5, text: { a: 1 }, fields: [{ name: "a", value: 7, type: "weird", required: "yes" }] });
    expect(dialog.title).toBe("Extension");
    expect(dialog.text).toBeUndefined();
    expect(dialog.fields[0]).toMatchObject({ value: "", type: "text", required: false });
  });
});
