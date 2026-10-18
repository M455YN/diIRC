import hljs from "highlight.js";

/**
 * Utilities for Markdown handling — link extraction, trailing punctuation fix, etc.
 * Keeps compatibility with existing `image-utils.ts` and `link-preview.tsx` expectations.
 */

// Regex fragments similar to original but used for fallback when markdown disabled
export const urlRegexRaw = /(https?:\/\/[^\s]+)/g;

/**
 * Strips trailing punctuation that is often captured incorrectly: `)`, `]`, `.`, `,`, `!`, `?`, `"`, `'`
 * And handles balanced parentheses case: if URL contains `(` then keep one `)`.
 */
export function stripTrailingPunct(url: string): string {
  if (!url) return url;
  // Remove trailing punctuation iteratively
  let cleaned = url;
  // Common trailing chars that are not part of URL when at end
  // Keep `)` only if balanced
  while (cleaned.length > 0) {
    const last = cleaned[cleaned.length - 1];
    if ([ ".", ",", "!", "?", ";", ":", "'", '"', "]"].includes(last)) {
      cleaned = cleaned.slice(0, -1);
      continue;
    }
    if (last === ")") {
      // Count '(' vs ')' inside cleaned
      const open = (cleaned.match(/\(/g) || []).length;
      const close = (cleaned.match(/\)/g) || []).length;
      // If more closing than opening, strip one
      if (close > open) {
        cleaned = cleaned.slice(0, -1);
        continue;
      }
      break;
    }
    break;
  }
  return cleaned;
}

/**
 * Extracts URLs from markdown AST-like rendering? For compatibility we provide fallback that extracts
 * from raw text but excludes code blocks/inline code.
 * 
 * Strategy: Remove code blocks (``` ... ```) and inline code (`...`) before regex, then match URLs
 * and clean punctuation.
 */
export function extractUrlsFromMarkdownText(text: string): string[] {
  if (!text) return [];
  // Remove ```code blocks```
  let stripped = text.replace(/```[\s\S]*?```/g, " ");
  // Remove `inline code`
  stripped = stripped.replace(/`[^`]*`/g, " ");
  // Also remove spoiler ||...|| content? Keep URL inside spoiler? For now extract but preview hidden until revealed.
  // We will still extract but LinkPreview will handle spoiler separately (not shown).
  const matches = stripped.match(urlRegexRaw) || [];
  const cleaned = matches.map(stripTrailingPunct).filter(Boolean);
  // Dedup
  return Array.from(new Set(cleaned));
}

/**
 * Checks if a markdown link href is safe (http/https/mailto only)
 */
export function isSafeHref(href: string): boolean {
  if (!href) return false;
  try {
    const url = new URL(href);
    return ["http:", "https:", "mailto:", "irc:", "ircs:"].includes(url.protocol);
  } catch {
    // Relative URLs not allowed in chat — treat as unsafe
    return false;
  }
}

/**
 * Simple helper to wrap selection in textarea for toolbar actions.
 */
export function wrapSelection(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder = "text"
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const selected = value.slice(start, end) || placeholder;
  const newValue = value.slice(0, start) + before + selected + after + value.slice(end);
  return {
    newValue,
    newSelectionStart: start + before.length,
    newSelectionEnd: start + before.length + selected.length,
  };
}

interface MarkdownWrapRegion {
  open: number;
  close: number;
  innerStart: number;
  innerEnd: number;
}

function isSingleStarAt(value: string, index: number): boolean {
  if (value[index] !== "*") return false;
  if (value.startsWith("***", index)) return false;
  if (value.startsWith("**", index)) return false;
  if (index > 0 && value[index - 1] === "*") return false;
  return true;
}

function findRegionsForToken(value: string, token: string): MarkdownWrapRegion[] {
  const len = token.length;
  const regions: MarkdownWrapRegion[] = [];
  let i = 0;

  while (i < value.length) {
    if (!value.startsWith(token, i)) {
      i++;
      continue;
    }

    if (token === "**" && value.startsWith("***", i)) {
      i++;
      continue;
    }

    if (token === "*" && !isSingleStarAt(value, i)) {
      i++;
      continue;
    }

    const innerStart = i + len;
    let close = -1;
    let searchFrom = innerStart;

    while (searchFrom <= value.length - len) {
      const idx = value.indexOf(token, searchFrom);
      if (idx === -1) break;

      if (token === "**" && value.startsWith("***", idx)) {
        searchFrom = idx + 1;
        continue;
      }

      if (token === "*" && !isSingleStarAt(value, idx)) {
        searchFrom = idx + 1;
        continue;
      }

      close = idx;
      break;
    }

    if (close === -1) {
      i++;
      continue;
    }

    regions.push({
      open: i,
      close: close + len,
      innerStart,
      innerEnd: close,
    });
    i = close + len;
  }

  return regions;
}

function getFormatRegions(value: string, before: string, after: string): MarkdownWrapRegion[] {
  if (before !== after) return findRegionsForToken(value, before);

  if (before === "**") {
    return [...findRegionsForToken(value, "***"), ...findRegionsForToken(value, "**")];
  }

  if (before === "*") {
    return [...findRegionsForToken(value, "***"), ...findRegionsForToken(value, "*")];
  }

  return findRegionsForToken(value, before);
}

function isAdjacentMarkdownWrap(
  value: string,
  start: number,
  end: number,
  before: string,
  after: string
): boolean {
  if (start < before.length || end + after.length > value.length) return false;
  if (value.slice(start - before.length, start) !== before) return false;
  if (value.slice(end, end + after.length) !== after) return false;

  if (before === "*" && after === "*") {
    if (!isSingleStarAt(value, start - before.length)) return false;
    if (!isSingleStarAt(value, end)) return false;
  }

  if (before === "**" && after === "**") {
    const open = start - before.length;
    if (value.startsWith("***", open) || value.startsWith("***", end)) return false;
  }

  return true;
}

function unwrapRegion(
  value: string,
  region: MarkdownWrapRegion,
  selectionStart: number,
  selectionEnd: number
) {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const newValue =
    value.slice(0, region.open) +
    value.slice(region.innerStart, region.innerEnd) +
    value.slice(region.close);
  const offset = region.open - region.innerStart;
  return {
    newValue,
    newSelectionStart: start + offset,
    newSelectionEnd: end + offset,
  };
}

function replaceRegionDelimiters(
  value: string,
  region: MarkdownWrapRegion,
  openDelimiter: string,
  closeDelimiter: string,
  selectionStart: number,
  selectionEnd: number
) {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const inner = value.slice(region.innerStart, region.innerEnd);
  const newValue =
    value.slice(0, region.open) +
    openDelimiter +
    inner +
    closeDelimiter +
    value.slice(region.close);
  const delta = region.open + openDelimiter.length - region.innerStart;
  return {
    newValue,
    newSelectionStart: start + delta,
    newSelectionEnd: end + delta,
  };
}

function tryRemoveFormatLayer(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string
) {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);

  if (before === "*" && after === "*") {
    const singleRegions = findRegionsForToken(value, "*")
      .filter((region) => start >= region.innerStart && end <= region.innerEnd)
      .sort((a, b) => a.innerEnd - a.innerStart - (b.innerEnd - b.innerStart));

    if (singleRegions.length > 0) {
      return unwrapRegion(value, singleRegions[0], selectionStart, selectionEnd);
    }

    const tripleRegions = findRegionsForToken(value, "***").filter(
      (region) => start >= region.innerStart && end <= region.innerEnd
    );
    if (tripleRegions.length > 0) {
      return replaceRegionDelimiters(value, tripleRegions[0], "**", "**", selectionStart, selectionEnd);
    }

    return null;
  }

  if (before === "**" && after === "**") {
    const tripleRegions = findRegionsForToken(value, "***").filter(
      (region) => start >= region.innerStart && end <= region.innerEnd
    );
    if (tripleRegions.length > 0) {
      return replaceRegionDelimiters(value, tripleRegions[0], "*", "*", selectionStart, selectionEnd);
    }

    const doubleRegions = findRegionsForToken(value, "**")
      .filter((region) => start >= region.innerStart && end <= region.innerEnd)
      .sort((a, b) => b.innerEnd - b.innerStart - (a.innerEnd - a.innerStart));

    if (doubleRegions.length > 0) {
      return unwrapRegion(value, doubleRegions[0], selectionStart, selectionEnd);
    }

    return null;
  }

  const region = findInnermostFormatRegion(value, selectionStart, selectionEnd, before, after);
  if (!region) return null;
  return unwrapRegion(value, region, selectionStart, selectionEnd);
}

function findInnermostFormatRegion(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string
): MarkdownWrapRegion | null {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);

  if (isAdjacentMarkdownWrap(value, start, end, before, after)) {
    return {
      open: start - before.length,
      close: end + after.length,
      innerStart: start,
      innerEnd: end,
    };
  }

  const containing = getFormatRegions(value, before, after)
    .filter((region) => start >= region.innerStart && end <= region.innerEnd)
    .sort((a, b) => a.innerEnd - a.innerStart - (b.innerEnd - b.innerStart));

  return containing[0] ?? null;
}

export function isMarkdownFormatActive(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  before: string,
  after: string
): boolean {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);

  return getFormatRegions(value, before, after).some(
    (region) => start >= region.innerStart && end <= region.innerEnd
  );
}

/**
 * Wraps selection in markers, or removes them when already applied (toggle).
 */
export function toggleMarkdownWrap(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
  placeholder = "text"
) {
  const selectionStart = textarea.selectionStart;
  const selectionEnd = textarea.selectionEnd;
  const value = textarea.value;

  if (isMarkdownFormatActive(value, selectionStart, selectionEnd, before, after)) {
    const removed = tryRemoveFormatLayer(value, selectionStart, selectionEnd, before, after);
    if (removed) return removed;
  }

  return wrapSelection(textarea, before, after, placeholder);
}

function getSelectedLineRange(value: string, selectionStart: number, selectionEnd: number) {
  const start = Math.min(selectionStart, selectionEnd);
  const end = Math.max(selectionStart, selectionEnd);
  const lineStart = value.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const lineEndRaw = value.indexOf("\n", end);
  const lineEnd = lineEndRaw === -1 ? value.length : lineEndRaw;
  return { lineStart, lineEnd, selectionStart: start, selectionEnd: end };
}

/**
 * Strips uniform leading whitespace/tabs (common indentation) from multiline or indented text blocks.
 */
export function dedentCode(text: string): string {
  if (!text) return text;

  const lines = text.split("\n");
  let minIndent: number | null = null;

  for (const line of lines) {
    if (line.trim().length === 0) continue;

    const match = line.match(/^([ \t]+)/);
    const indentLength = match ? match[1].length : 0;

    if (minIndent === null || indentLength < minIndent) {
      minIndent = indentLength;
    }
  }

  if (minIndent === null || minIndent === 0) {
    return text;
  }

  return lines
    .map((line) => {
      if (line.trim().length === 0) return "";
      return line.slice(minIndent!);
    })
    .join("\n");
}

const HLJS_SUBSET = [
  "javascript", "typescript", "python", "rust", "cpp", "c", "csharp",
  "java", "html", "css", "json", "sql", "bash", "go", "php", "ruby",
  "yaml", "xml", "markdown"
];

/**
 * Detects the programming language of a snippet of code.
 * Returns language identifier (e.g. "javascript", "python") or null if unknown / low confidence.
 */
export function detectCodeLanguage(code: string): string | null {
  if (!code || !code.trim()) return null;
  try {
    const result = hljs.highlightAuto(code, HLJS_SUBSET);
    if (result.language && result.relevance >= 3) {
      return result.language;
    }
  } catch (e) {
    console.error("Language detection error:", e);
  }
  return null;
}

export function wrapCodeBlock(textarea: HTMLTextAreaElement, placeholder = "code") {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  let selected = value.slice(start, end);

  const fenceBefore = "```\n";
  const fenceAfter = "\n```";

  if (!selected) {
    selected = placeholder;
  } else {
    selected = dedentCode(selected.replace(/^\n+|\n+$/g, ""));
  }

  const newValue = value.slice(0, start) + fenceBefore + selected + fenceAfter + value.slice(end);
  return {
    newValue,
    newSelectionStart: start + fenceBefore.length,
    newSelectionEnd: start + fenceBefore.length + selected.length,
  };
}

function calculateNewSelection(
  selectionStart: number,
  selectionEnd: number,
  lineStart: number,
  oldBlockLength: number,
  newBlockLength: number,
  allEmpty: boolean
): { newSelectionStart: number; newSelectionEnd: number } {
  let newSelectionStart: number;
  let newSelectionEnd: number;

  if (selectionStart === selectionEnd) {
    if (allEmpty) {
      newSelectionStart = lineStart + newBlockLength;
      newSelectionEnd = lineStart + newBlockLength;
    } else {
      const delta = newBlockLength - oldBlockLength;
      const newPos = Math.max(lineStart, selectionStart + delta);
      newSelectionStart = newPos;
      newSelectionEnd = newPos;
    }
  } else {
    newSelectionStart = lineStart;
    newSelectionEnd = lineStart + newBlockLength;
  }

  return { newSelectionStart, newSelectionEnd };
}

export function toggleLinePrefix(
  textarea: HTMLTextAreaElement,
  prefix: string,
  options?: { numbered?: boolean }
) {
  const { selectionStart, selectionEnd, value } = textarea;
  const { lineStart, lineEnd } = getSelectedLineRange(value, selectionStart, selectionEnd);
  const oldBlock = value.slice(lineStart, lineEnd);
  const lines = oldBlock.split("\n");

  const hasAnyNonEmpty = lines.some((line) => line !== "");
  const allEmpty = !hasAnyNonEmpty;

  let newLines: string[];
  if (options?.numbered) {
    const orderedPattern = /^\d+\.\s/;
    const hasNumbered = lines.some((line) => orderedPattern.test(line));
    const allNumbered = hasNumbered && lines.every((line) => line === "" || orderedPattern.test(line));
    if (allNumbered) {
      newLines = lines.map((line) => (line === "" ? line : line.replace(orderedPattern, "")));
    } else {
      let index = 1;
      newLines = lines.map((line) => {
        if (line === "" && !allEmpty) return line;
        return `${index++}. ${line}`;
      });
    }
  } else {
    const hasPrefixed = lines.some((line) => line.startsWith(prefix));
    const allPrefixed = hasPrefixed && lines.every((line) => line === "" || line.startsWith(prefix));
    if (allPrefixed) {
      newLines = lines.map((line) => (line.startsWith(prefix) ? line.slice(prefix.length) : line));
    } else {
      newLines = lines.map((line) => {
        if (line === "" && !allEmpty) return line;
        if (line.startsWith(prefix)) return line;
        return `${prefix}${line}`;
      });
    }
  }

  const newBlock = newLines.join("\n");
  const newValue = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);

  const { newSelectionStart, newSelectionEnd } = calculateNewSelection(
    selectionStart,
    selectionEnd,
    lineStart,
    oldBlock.length,
    newBlock.length,
    allEmpty
  );

  return {
    newValue,
    newSelectionStart,
    newSelectionEnd,
  };
}

export function toggleHeadingPrefix(textarea: HTMLTextAreaElement, level: 1 | 2 | 3) {
  const prefix = `${"#".repeat(level)} `;
  const { selectionStart, selectionEnd, value } = textarea;
  const { lineStart, lineEnd } = getSelectedLineRange(value, selectionStart, selectionEnd);
  const oldBlock = value.slice(lineStart, lineEnd);
  const lines = oldBlock.split("\n");

  const hasAnyNonEmpty = lines.some((line) => line !== "");
  const allEmpty = !hasAnyNonEmpty;

  const newLines = lines.map((line) => {
    if (line === "" && !allEmpty) return line;

    const headingMatch = line.match(/^(#{1,6})\s/);
    if (headingMatch) {
      const currentLevel = headingMatch[1].length;
      const content = line.slice(headingMatch[0].length);
      if (currentLevel === level) {
        return content;
      }
      return `${prefix}${content}`;
    }

    return `${prefix}${line}`;
  });

  const newBlock = newLines.join("\n");
  const newValue = value.slice(0, lineStart) + newBlock + value.slice(lineEnd);

  const { newSelectionStart, newSelectionEnd } = calculateNewSelection(
    selectionStart,
    selectionEnd,
    lineStart,
    oldBlock.length,
    newBlock.length,
    allEmpty
  );

  return {
    newValue,
    newSelectionStart,
    newSelectionEnd,
  };
}

/**
 * Detects if text contains any Markdown syntax that should trigger markdown rendering.
 * Used to make markdown "only when user adds markdown characters" — plain text without markers
 * renders via legacy plain path (no extra <p> etc.).
 */
export function hasMarkdownSyntax(text: string): boolean {
  if (!text) return false;
  // Quick checks for common markdown markers
  // Bold/italic/underline/strike: **, *, __, ~~
  if (/\*\*[^*]+\*\*/.test(text)) return true;
  if (/(^|[^*])\*[^*\n]+\*([^*]|$)/.test(text)) return true; // simple single * italic (avoid **)
  if (/__[^_\n]+__/.test(text)) return true;
  if (/~~[^~\n]+~~/.test(text)) return true;
  if (/\|\|[^|\n]+\|\|/.test(text)) return true;
  if (/`[^`\n]+`/.test(text)) return true;
  if (/```/.test(text)) return true;
  if (/^>\s/m.test(text)) return true; // blockquote at line start
  if (/^#{1,6}\s/m.test(text)) return true; // heading
  if (/^\s*[-*]\s/m.test(text)) return true; // unordered list
  if (/^\s*\d+\.\s/m.test(text)) return true; // ordered list
  if (/\[.+\]\(https?:\/\/[^\s]+\)/.test(text)) return true; // markdown link
  if (/^---\s*$/m.test(text) || /^___\s*$/m.test(text) || /^\*\*\*\s*$/m.test(text)) return true; // hr
  return false;
}

export interface MarkdownContentBlock {
  id: string;
  markdown: string;
  urls: string[];
}

/**
 * Parses markdown text into logical content blocks (paragraphs, headings, code blocks, etc.),
 * extracting media/link URLs per block so that previews can be rendered in-place right below
 * the section where they are referenced.
 */
export function parseMarkdownContentBlocks(
  content: string,
  enableLinkPreviews = true
): MarkdownContentBlock[] {
  if (!content || !content.trim()) return [];

  const lines = content.split("\n");
  const blocks: MarkdownContentBlock[] = [];
  let currentLines: string[] = [];
  let currentUrls: string[] = [];
  let inCodeBlock = false;
  let blockCounter = 0;

  const flushBlock = () => {
    if (currentLines.length === 0) return;
    const markdown = currentLines.join("\n");
    blocks.push({
      id: `block-${++blockCounter}`,
      markdown,
      urls: enableLinkPreviews ? Array.from(new Set(currentUrls)) : [],
    });
    currentLines = [];
    currentUrls = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // 1. Code blocks: ```
    if (trimmed.startsWith("```")) {
      if (!inCodeBlock) {
        flushBlock();
        inCodeBlock = true;
        currentLines.push(line);
      } else {
        currentLines.push(line);
        inCodeBlock = false;
        flushBlock();
      }
      continue;
    }

    if (inCodeBlock) {
      currentLines.push(line);
      continue;
    }

    // 2. Empty line: paragraph separator
    if (trimmed === "") {
      flushBlock();
      continue;
    }

    // 3. Headings (#, ##, ###, etc.): standalone blocks
    if (/^#{1,6}\s/.test(trimmed)) {
      flushBlock();
      currentLines.push(line);
      flushBlock();
      continue;
    }

    // 4. Regular lines: check for URLs
    const lineUrls = enableLinkPreviews ? extractUrlsFromMarkdownText(line) : [];

    if (lineUrls.length > 0) {
      // If current block already contains URLs, flush previous block
      if (currentUrls.length > 0) {
        flushBlock();
      }
      currentLines.push(line);
      currentUrls.push(...lineUrls);
      flushBlock();
    } else {
      currentLines.push(line);
    }
  }

  flushBlock();
  return blocks;
}

