import React, { useMemo, useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeSanitize from "rehype-sanitize";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check } from "lucide-react";
import { markdownSanitizeSchema } from "./markdown-config";
import { remarkSpoiler, remarkUnderline, remarkMention } from "./remark-plugins";
import { openExternalUrl, copyToClipboard } from "@/lib/system-utils";
import { cn } from "@/lib/utils";
import { isSafeHref } from "./markdown-utils";
import { isMediaUrl } from "@/lib/image-utils";
import { useMockStore } from "@/lib/mock-store";
import { getOnlyEmojiCount, getEmojiSizeProps } from "@/lib/emoji-utils";

interface MarkdownRendererProps {
  content: string;
  onContentSizeChange?: () => void;
  className?: string;
  compact?: boolean;
  myNicks?: string[];
  allMemberNicks?: string[];
  allowImages?: boolean;
}

// CodeBlock component with syntax highlighting & copy button
const CodeBlock: React.FC<{ language: string; code: string; onContentSizeChange?: () => void }> = ({
  language,
  code,
  onContentSizeChange,
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    onContentSizeChange?.();
  }, [onContentSizeChange, code]);

  const handleCopy = async () => {
    const success = await copyToClipboard(code);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const displayLanguage = language ? language.toLowerCase() : "text";

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 bg-zinc-950 dark:bg-[#18191c] overflow-hidden my-2 group w-full max-w-full min-w-0">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 dark:bg-[#1e1f22] border-b border-zinc-800 text-zinc-400 text-xs font-mono select-none">
        <span className="uppercase tracking-wider font-semibold text-[11px] text-zinc-400">
          {displayLanguage}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-zinc-400 hover:text-zinc-200 transition-colors px-2 py-0.5 rounded hover:bg-zinc-800/60"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 text-xs">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span className="text-xs">Copy code</span>
            </>
          )}
        </button>
      </div>
      <div className="overflow-x-auto p-3 text-[13px] font-mono leading-5 w-full min-w-0">
        <SyntaxHighlighter
          language={displayLanguage}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: 0,
            background: "transparent",
            fontSize: "13px",
            lineHeight: "1.25rem",
          }}
          codeTagProps={{
            style: {
              fontFamily: "var(--font-mono, monospace)",
            },
          }}
          PreTag="div"
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

// Spoiler component — hidden until clicked
const SpoilerInline: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      onClick={() => setRevealed((v) => !v)}
      title={revealed ? "Click to hide" : "Click to reveal spoiler"}
      className={cn(
        "rounded px-1 py-0.5 cursor-pointer select-none transition",
        revealed
          ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100"
          : "bg-zinc-800 dark:bg-zinc-900 text-transparent hover:text-zinc-400 dark:hover:text-zinc-500"
      )}
    >
      <span className={cn(revealed ? "opacity-100" : "opacity-0 hover:opacity-20")}>{children}</span>
    </span>
  );
};

const Underline: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <u className="underline decoration-zinc-400 dark:decoration-zinc-500 underline-offset-2">{children}</u>;
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  onContentSizeChange,
  className,
  compact = false,
  myNicks = [],
  allMemberNicks = [],
  allowImages = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const enableLinkPreviews = useMockStore((s) => s.enableLinkPreviews);
  const jumbojiSize = useMockStore((s) => s.jumbojiSize ?? 42);

  useEffect(() => {
    if (!onContentSizeChange) return;
    const el = containerRef.current;
    if (!el) return;
    onContentSizeChange();
    const ro = new ResizeObserver(() => onContentSizeChange());
    ro.observe(el);
    return () => ro.disconnect();
  }, [content, onContentSizeChange]);

  const remarkPlugins = useMemo(
    () => [[remarkMention, { myNicks, allMemberNicks }] as any, remarkSpoiler, remarkUnderline, remarkGfm, remarkBreaks],
    [myNicks, allMemberNicks]
  );
  const rehypePlugins = useMemo(() => [[rehypeSanitize, markdownSanitizeSchema] as any], []);

  if (!content || !content.trim()) return null;

  const onlyEmojiCount = getOnlyEmojiCount(content);
  const isOnlyEmoji = jumbojiSize > 0 && onlyEmojiCount > 0 && onlyEmojiCount <= 16;
  const emojiSizeProps = getEmojiSizeProps(onlyEmojiCount, jumbojiSize);

  const components: any = {
    p: ({ children }: any) => (
      <p
        style={isOnlyEmoji ? emojiSizeProps.style : undefined}
        className={cn(
          "my-1 text-zinc-600 dark:text-zinc-300 leading-6",
          isOnlyEmoji && emojiSizeProps.className
        )}
      >
        {children}
      </p>
    ),
    strong: ({ children }: any) => <strong className="font-bold text-zinc-900 dark:text-zinc-100">{children}</strong>,
    em: ({ children }: any) => <em className="italic">{children}</em>,
    del: ({ children }: any) => <del className="line-through opacity-80 decoration-2">{children}</del>,
    code: ({ children, className: _className, ...props }: any) => {
      const match = /language-(\w+)/.exec(_className || "");
      const childStr = String(children);
      const isMultiLine = childStr.includes("\n");
      const isBlock = Boolean(match) || isMultiLine || props.inline === false;

      if (isBlock) {
        const lang = match ? match[1] : "text";
        return (
          <CodeBlock
            language={lang}
            code={childStr.replace(/\n$/, "")}
            onContentSizeChange={onContentSizeChange}
          />
        );
      }

      return (
        <code
          className="bg-zinc-100 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded text-[13px] font-mono border border-zinc-200 dark:border-zinc-700 text-rose-600 dark:text-rose-400"
          {...props}
        >
          {children}
        </code>
      );
    },
    pre: ({ children }: any) => <div className="my-1">{children}</div>,
    blockquote: ({ children }: any) => (
      <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-3 py-1 my-2 italic bg-zinc-50 dark:bg-zinc-800/40 rounded-r text-zinc-600 dark:text-zinc-300">
        {children}
      </blockquote>
    ),
    ul: ({ children }: any) => <ul className="list-disc ml-6 my-1 space-y-0.5 marker:text-zinc-400">{children}</ul>,
    ol: ({ children }: any) => <ol className="list-decimal ml-6 my-1 space-y-0.5 marker:text-zinc-400">{children}</ol>,
    li: ({ children }: any) => <li className="leading-6">{children}</li>,
    h1: ({ children }: any) => <h1 className="text-xl font-bold mt-3 mb-1 text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-700 pb-1">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-lg font-bold mt-3 mb-1 text-zinc-900 dark:text-zinc-100">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-base font-bold mt-2 mb-1 text-zinc-900 dark:text-zinc-100">{children}</h3>,
    h4: ({ children }: any) => <h4 className="text-sm font-bold mt-2 mb-1 text-zinc-900 dark:text-zinc-100">{children}</h4>,
    h5: ({ children }: any) => <h5 className="text-sm font-semibold mt-2 mb-1 text-zinc-800 dark:text-zinc-200">{children}</h5>,
    h6: ({ children }: any) => <h6 className="text-xs font-semibold uppercase tracking-wide mt-2 mb-1 text-zinc-600 dark:text-zinc-400">{children}</h6>,
    a: ({ href, children }: any) => {
      const safe = href ? isSafeHref(href) : false;
      if (!safe || !href) {
        return <span className="text-zinc-600 dark:text-zinc-300">{children}</span>;
      }
      if (allowImages && enableLinkPreviews && isMediaUrl(href)) {
        return null;
      }
      return (
        <button
          type="button"
          onClick={() => openExternalUrl(href)}
          className="text-indigo-500 dark:text-indigo-400 hover:underline break-all inline text-left p-0 bg-transparent border-none font-normal"
          title={href}
        >
          {children}
        </button>
      );
    },
    hr: () => <hr className="my-2 border-zinc-200 dark:border-zinc-700" />,
    img: ({ src, alt }: any) => {
      if (!allowImages || !src || !isSafeHref(src)) return null;
      return (
        <img
          src={src}
          alt={alt || "image"}
          loading="lazy"
          className="max-w-full h-auto rounded-md border border-zinc-200 dark:border-zinc-700 my-2"
          onLoad={onContentSizeChange}
          onError={onContentSizeChange}
        />
      );
    },
    spoiler: ({ children }: any) => <SpoilerInline>{children}</SpoilerInline>,
    underline: ({ children }: any) => <Underline>{children}</Underline>,
    u: ({ children }: any) => <Underline>{children}</Underline>,
    mention: ({ children, isMyMention, ...props }: any) => {
      const isMine = isMyMention === "true" || props["data-is-my-mention"] === "true";
      return (
        <span
          className={cn(
            "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold transition-colors mx-0.5 select-none",
            isMine
              ? "bg-amber-500/25 dark:bg-amber-500/35 text-amber-900 dark:text-amber-200 border border-amber-500/30"
              : "bg-indigo-500/15 dark:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20"
          )}
        >
          {children}
        </span>
      );
    },
    input: (props: any) => {
      if (props.type === "checkbox") {
        return <input type="checkbox" checked={!!props.checked} disabled className="mr-2 align-middle" {...props} />;
      }
      return <input {...props} />;
    },
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "markdown-root text-sm leading-6 break-words min-w-0 w-full max-w-full",
        compact ? "space-y-0" : "space-y-1",
        className
      )}
    >
      <ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
