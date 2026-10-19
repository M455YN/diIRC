import type { DialogButton, DialogField, DialogSpec } from "./types";

// Pure helpers for what an extension sends us: nothing here touches the app.

export const MAX_TEXT = 1024 * 1024;
/** One chat line; the message goes out as typed, so it has to fit an IRC line. */
export const MAX_SEND_CHARS = 400;
const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,31}$/;

export const text = (value: unknown, max: number, fallback = ""): string =>
  typeof value === "string" ? value.slice(0, max) : fallback;

/** Turns whatever the extension sent into a dialog we are willing to draw. */
export function cleanDialog(raw: unknown): DialogSpec {
  const input = (raw ?? {}) as Record<string, unknown>;
  const fields: DialogField[] = (Array.isArray(input.fields) ? input.fields : []).slice(0, 5).map((item) => {
    const field = (item ?? {}) as Record<string, unknown>;
    const name = text(field.name, 32);
    if (!FIELD_NAME.test(name)) throw new Error("Invalid dialog field name");
    return {
      name,
      label: text(field.label, 80) || undefined,
      type: field.type === "textarea" ? "textarea" : "text",
      value: text(field.value, MAX_TEXT),
      placeholder: text(field.placeholder, 120) || undefined,
      required: field.required === true,
    };
  });
  let buttons: DialogButton[] = (Array.isArray(input.buttons) ? input.buttons : []).slice(0, 4).map((item) => {
    const button = (item ?? {}) as Record<string, unknown>;
    return { id: text(button.id, 20) || "ok", label: text(button.label, 30) || "OK", primary: button.primary === true };
  });
  if (buttons.length === 0) buttons = [{ id: "ok", label: "OK", primary: true }];
  const link = text(input.link, 500);
  const sendText = typeof input.sendText === "string" ? input.sendText : "";
  if (sendText && (sendText.length > MAX_SEND_CHARS || /[\r\n]/.test(sendText))) {
    throw new Error(`sendText must be a single line of at most ${MAX_SEND_CHARS} characters`);
  }
  return {
    title: text(input.title, 100, "Extension"),
    text: text(input.text, 4000) || undefined,
    fields,
    link: /^https?:\/\//i.test(link) ? link : undefined,
    copyText: text(input.copyText, MAX_TEXT) || undefined,
    sendText: sendText || undefined,
    buttons,
  };
}
