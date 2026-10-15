import React from "react";
import { openLink } from "@/lib/system-utils";

export const MIRC_COLORS: Record<number, string> = {
  0: "#ffffff", // White
  1: "#2b2d31", // Black
  2: "#3b82f6", // Navy / Blue
  3: "#22c55e", // Green
  4: "#ef4444", // Red
  5: "#b45309", // Brown / Maroon
  6: "#a855f7", // Purple
  7: "#f97316", // Orange
  8: "#eab308", // Yellow
  9: "#84cc16", // Lime / Light Green
  10: "#14b8a6", // Teal / Cyan
  11: "#06b6d4", // Light Cyan / Aqua
  12: "#60a5fa", // Royal Blue
  13: "#ec4899", // Pink / Fuchsia
  14: "#9ca3af", // Grey
  15: "#e5e7eb", // Light Grey
};

export interface IrcFormattedSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: number;
  bgColor?: number;
}

/**
 * Checks if a string contains IRC control codes (\x02, \x03, \x1D, \x1F, \x1E, \x0F, \x16).
 */
export function hasIrcControlCodes(text: string): boolean {
  return /[\u0002\u0003\u000F\u0016\u001D\u001E\u001F]/.test(text);
}

/**
 * Strips all IRC control codes from text.
 */
export function stripIrcCodes(text: string): string {
  return text.replace(/\u0003(?:\d{1,2}(?:,\d{1,2})?)?|[\u0002\u000F\u0016\u001D\u001E\u001F]/g, "");
}

/**
 * Checks if a line or MOTD contains a diIRC formatting marker tag, e.g. [dirc-format], [format=dirc], [diirc], etc.
 */
export function isDircTagLine(line: string): boolean {
  const stripped = stripIrcCodes(line).trim().toLowerCase();
  return (
    stripped === "[dirc]" ||
    stripped === "[diirc]" ||
    stripped === "[lunairc]" ||
    stripped === "[luna]" ||
    stripped === "[dirc-format]" ||
    stripped === "[diirc-format]" ||
    stripped === "[lunairc-format]" ||
    stripped === "[luna-format]" ||
    stripped === "[dirc-motd]" ||
    stripped === "[diirc-motd]" ||
    stripped === "[lunairc-motd]" ||
    stripped === "[luna-motd]" ||
    stripped === "[format: dirc]" ||
    stripped === "[format: diirc]" ||
    stripped === "[format: lunairc]" ||
    stripped === "[format: luna]" ||
    stripped === "[format=dirc]" ||
    stripped === "[format=diirc]" ||
    stripped === "[format=lunairc]" ||
    stripped === "[format=luna]" ||
    stripped === "<!-- dirc -->" ||
    stripped === "<!-- diirc -->" ||
    stripped === "<!-- lunairc -->" ||
    stripped === "<!-- luna -->"
  );
}

/**
 * Inspects a list of MOTD lines and determines if it is flagged as a diIRC-formatted MOTD.
 * Returns whether it's diIRC and the lines with the tag stripped out.
 */
export function detectMotdFormat(lines: string[]): { isDirc: boolean; cleanedLines: string[] } {
  let isDirc = false;
  const cleaned: string[] = [];

  for (const line of lines) {
    if (isDircTagLine(line)) {
      isDirc = true;
    } else {
      cleaned.push(line);
    }
  }

  return { isDirc, cleanedLines: cleaned };
}

/**
 * Parses IRC formatting codes into structured spans with styling.
 */
export function parseIrcSpans(rawText: string): IrcFormattedSpan[] {
  const spans: IrcFormattedSpan[] = [];
  let bold = false;
  let italic = false;
  let underline = false;
  let strikethrough = false;
  let color: number | undefined;
  let bgColor: number | undefined;

  let currentBuffer = "";

  const flush = () => {
    if (currentBuffer.length > 0) {
      spans.push({
        text: currentBuffer,
        bold,
        italic,
        underline,
        strikethrough,
        color,
        bgColor,
      });
      currentBuffer = "";
    }
  };

  let i = 0;
  while (i < rawText.length) {
    const char = rawText[i];
    const code = rawText.charCodeAt(i);

    if (code === 0x02) {
      // Bold toggle
      flush();
      bold = !bold;
      i++;
    } else if (code === 0x1d) {
      // Italic toggle
      flush();
      italic = !italic;
      i++;
    } else if (code === 0x1f) {
      // Underline toggle
      flush();
      underline = !underline;
      i++;
    } else if (code === 0x1e) {
      // Strikethrough toggle
      flush();
      strikethrough = !strikethrough;
      i++;
    } else if (code === 0x16) {
      // Reverse colors toggle
      flush();
      const temp = color;
      color = bgColor;
      bgColor = temp;
      i++;
    } else if (code === 0x0f) {
      // Reset all formatting
      flush();
      bold = false;
      italic = false;
      underline = false;
      strikethrough = false;
      color = undefined;
      bgColor = undefined;
      i++;
    } else if (code === 0x03) {
      // Color code \x03[FG][,BG]
      flush();
      i++;
      const colorMatch = rawText.slice(i).match(/^(\d{1,2})(?:,(\d{1,2}))?/);
      if (colorMatch) {
        color = parseInt(colorMatch[1], 10) % 16;
        if (colorMatch[2] !== undefined) {
          bgColor = parseInt(colorMatch[2], 10) % 16;
        }
        i += colorMatch[0].length;
      } else {
        // \x03 without numbers resets color
        color = undefined;
        bgColor = undefined;
      }
    } else {
      currentBuffer += char;
      i++;
    }
  }

  flush();
  return spans;
}

/**
 * Renders an IRC span with proper styling and clickable URLs.
 */
export const IrcSpanNode: React.FC<{ span: IrcFormattedSpan }> = ({ span }) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = span.text.split(urlRegex);

  const style: React.CSSProperties = {};
  if (span.color !== undefined && MIRC_COLORS[span.color]) {
    style.color = MIRC_COLORS[span.color];
  }
  if (span.bgColor !== undefined && MIRC_COLORS[span.bgColor]) {
    style.backgroundColor = MIRC_COLORS[span.bgColor];
  }

  let className = "";
  if (span.bold) className += " font-bold";
  if (span.italic) className += " italic";
  if (span.underline) className += " underline underline-offset-2";
  if (span.strikethrough) className += " line-through";

  return (
    <span style={style} className={className.trim() || undefined}>
      {parts.map((part, index) => {
        if (part.match(urlRegex)) {
          return (
            <button
              key={index}
              type="button"
              onClick={() => openLink(part)}
              className="text-indigo-500 dark:text-indigo-400 hover:underline inline font-inherit text-left cursor-pointer p-0 bg-transparent border-none align-baseline"
            >
              {part}
            </button>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

/**
 * Renders a line of text with strict monospace character alignment for standard IRC ASCII art.
 */
export const IrcMonospaceLineRenderer: React.FC<{ line: string }> = ({ line }) => {
  const spans = parseIrcSpans(line);
  if (spans.length === 0) {
    return <div className="min-h-[1.25em] leading-[1.3]">&nbsp;</div>;
  }

  return (
    <div className="min-h-[1.25em] leading-[1.3] whitespace-pre font-mono">
      {spans.map((span, idx) => (
        <IrcSpanNode key={idx} span={span} />
      ))}
    </div>
  );
};

/**
 * Renders a line of text for diIRC mode with word wrapping.
 */
export const IrcLineRenderer: React.FC<{ line: string; className?: string }> = ({ line, className }) => {
  const spans = parseIrcSpans(line);
  if (spans.length === 0) {
    return <div className={`min-h-[1.25rem] leading-relaxed ${className || ""}`}>&nbsp;</div>;
  }

  return (
    <div className={`min-h-[1.25rem] leading-relaxed whitespace-pre-wrap break-words ${className || ""}`}>
      {spans.map((span, idx) => (
        <IrcSpanNode key={idx} span={span} />
      ))}
    </div>
  );
};
