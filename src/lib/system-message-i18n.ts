import i18n from "@/lib/i18n";

/**
 * The app writes its own system lines (joins, parts, quits, topic and mode changes) in English on the
 * backend. Stored lines keep that text, so the chat translates them when shown instead of at creation.
 * Anything that does not match a known pattern is shown unchanged.
 */
const RULES: { pattern: RegExp; render: (m: RegExpMatchArray) => string }[] = [
  { pattern: /^(.+) has joined$/s, render: (m) => i18n.t("sys.joined", { nick: m[1] }) },
  { pattern: /^(.+) has left \((.*)\)$/s, render: (m) => i18n.t("sys.leftReason", { nick: m[1], reason: m[2] }) },
  { pattern: /^(.+) has left$/s, render: (m) => i18n.t("sys.left", { nick: m[1] }) },
  { pattern: /^(.+) has quit \((.*)\)$/s, render: (m) => i18n.t("sys.quitReason", { nick: m[1], reason: m[2] }) },
  { pattern: /^(.+) has quit$/s, render: (m) => i18n.t("sys.quit", { nick: m[1] }) },
  { pattern: /^(.+) cleared the topic$/s, render: (m) => i18n.t("sys.topicCleared", { nick: m[1] }) },
  { pattern: /^(.+) changed the topic to: (.*)$/s, render: (m) => i18n.t("sys.topicChanged", { nick: m[1], topic: m[2] }) },
  {
    pattern: /^(.+) was kicked from (\S+) by (.+) \((.*)\)$/s,
    render: (m) => i18n.t("sys.kickedReason", { target: m[1], channel: m[2], by: m[3], reason: m[4] }),
  },
  { pattern: /^(.+) was kicked from (\S+) by (.+)$/s, render: (m) => i18n.t("sys.kicked", { target: m[1], channel: m[2], by: m[3] }) },
  { pattern: /^(.+) set mode: (\S+) (.*)$/s, render: (m) => i18n.t("sys.mode", { nick: m[1], channel: m[2], modes: m[3] }) },
  { pattern: /^(.+) is now known as (.+)$/s, render: (m) => i18n.t("sys.nick", { old: m[1], new: m[2] }) },
  { pattern: /^Channel (\S+) modes: (.*)$/s, render: (m) => i18n.t("sys.channelModes", { channel: m[1], modes: m[2] }) },
];

// Mode errors are the app's prefix wrapped around a server-supplied sentence; translate the parts we know.
const MODE_ERROR_PARTS: { pattern: RegExp; render: (m: RegExpMatchArray) => string }[] = [
  { pattern: /^Mode error: /, render: () => i18n.t("sys.modeError") },
  { pattern: /^Unknown mode flag '([^']*)'/, render: (m) => i18n.t("sys.unknownModeFlag", { flag: m[1] }) },
];

// The server sentence may arrive with or without the offending flag in front of it.
const RECOGNISED_MODE = /(\S+ )?is not a recognised (user|channel) mode\.?/g;
const translateRecognisedMode = (text: string): string =>
  text.replace(RECOGNISED_MODE, (_all, mode: string | undefined, kind: string) =>
    i18n
      .t(kind === "user" ? "sys.notUserMode" : "sys.notChannelMode", { mode: (mode || "").trim() })
      .trim()
  );

const translateModeError = (content: string): string => {
  if (!/Mode error: |is not a recognised (user|channel) mode/.test(content)) return content;
  let rest = content;
  let out = "";
  let progressed = true;
  while (rest && progressed) {
    progressed = false;
    for (const { pattern, render } of MODE_ERROR_PARTS) {
      const match = rest.match(pattern);
      if (match) {
        out += render(match);
        rest = rest.slice(match[0].length);
        progressed = true;
        break;
      }
    }
    // ": " separators between the parts are kept verbatim.
    if (!progressed && rest.startsWith(": ")) {
      out += ": ";
      rest = rest.slice(2);
      progressed = true;
    }
  }
  return translateRecognisedMode(out + rest);
};

export const translateSystemMessage = (content: string): string => {
  for (const { pattern, render } of RULES) {
    const match = content.match(pattern);
    if (match) return render(match);
  }
  return translateModeError(content);
};

/**
 * Away reasons come from the server or bouncer. ZNC sends "Away (Auto away at HH:MM)" when it marks
 * a user away automatically; show that in the interface language, other reasons unchanged.
 */
export const translateAwayReason = (reason: string): string => {
  const match = reason.match(/^Away \(Auto away at (.+)\)$/);
  return match ? i18n.t("away.autoAt", { time: match[1] }) : reason;
};
