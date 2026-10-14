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
];

export const translateSystemMessage = (content: string): string => {
  for (const { pattern, render } of RULES) {
    const match = content.match(pattern);
    if (match) return render(match);
  }
  return content;
};
