import { useState, useEffect, useMemo, memo } from "react";
import { Member, Profile } from "@/types";
import { Reply, AlertTriangle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { UserAvatar } from "@/components/user-avatar";
import { UserHoverCard, getMemberDisplayName } from "@/components/user-hover-card";
import { ActionTooltip } from "@/components/action-tooltip";
import { cn } from "@/lib/utils";
import { useMockStore } from "@/lib/mock-store";
import { focusChatMessage, useReplyStore } from "@/hooks/use-reply-store";
import { ChatItemAttachment } from "./chat-item-attachment";
import { LinkPreview } from "./link-preview";

import { isMediaUrl, subscribeImageCache } from "@/lib/image-utils";
import { openExternalUrl } from "@/lib/system-utils";
import { MarkdownRenderer } from "@/lib/markdown/markdown-renderer";
import { extractUrlsFromMarkdownText, stripTrailingPunct, hasMarkdownSyntax } from "@/lib/markdown/markdown-utils";
import { isBrokenHeader, stripSteganography } from "@/lib/markdown/multiline-steganography";
import { checkIsMention } from "@/lib/notification-service";
import { getOnlyEmojiCount, getEmojiSizeProps } from "@/lib/emoji-utils";

interface ChatItemProps {
  id: string;
  content: string;
  member: Member & {
    profile: Profile;
  };
  timestamp: string;
  compactTime?: string;
  fileUrl: string | null;
  deleted: boolean;
  currentMember: Member;
  channelId?: string;
  conversationId?: string;
  compact?: boolean;
  isSystem?: boolean;
  ircMsgid?: string;
  messageOffset?: number;
  replyTo?: {
    messageId: string;
    nick: string;
    preview: string;
    msgid?: string;
  };
  onContentSizeChange?: () => void;
}


const ChatItemInner = ({
  id,
  content,
  member,
  timestamp,
  compactTime,
  fileUrl,
  deleted,
  currentMember,
  channelId,
  conversationId,
  compact = false,
  isSystem = false,
  ircMsgid,
  messageOffset,
  replyTo,
  onContentSizeChange,
}: ChatItemProps) => {
  const params = useParams();
  const navigate = useNavigate();

  const compactMode = useMockStore((state) => state.compactMode);
  const enableLinkPreviews = useMockStore((state) => state.enableLinkPreviews);
  const enableMarkdown = useMockStore((state) => state.enableMarkdown ?? true);
  const jumbojiSize = useMockStore((state) => state.jumbojiSize ?? 42);
  const setPendingReply = useReplyStore((state) => state.setPending);
  const indexMsgid = useReplyStore((state) => state.indexMsgid);
  const storedReplyMeta = useReplyStore((state) => state.metaByMessageId[id]);
  const replyMeta = storedReplyMeta || replyTo;

  const chatId = channelId || conversationId;

  const handleReply = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!chatId || deleted || isSystem) return;
    if (ircMsgid) {
      indexMsgid(ircMsgid, {
        messageId: id,
        nick: member.profile.name,
        preview: content,
      });
    }
    setPendingReply(chatId, {
      messageId: id,
      nick: member.profile.name,
      preview: content,
      msgid: ircMsgid,
      parentOffset: messageOffset,
    });
    window.dispatchEvent(
      new CustomEvent("focus_chat_input", { detail: { chatId } })
    );
  };

  const [, setCacheTick] = useState(0);
  useEffect(() => {
    return subscribeImageCache(() => {
      setCacheTick((prev) => prev + 1);
    });
  }, []);

  const onMemberClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const activeServers = useMockStore.getState().servers;
    const serverId = params?.serverId || activeServers[0]?.id;
    if (!serverId) return;

    if (currentMember.id === member.id || currentMember.profile.name.toLowerCase() === member.profile.name.toLowerCase()) {
      return;
    }

    const server = activeServers.find((s) => s.id === serverId) || activeServers[0];
    if (!server) return;

    let targetMember = server.members.find(
      (m) => m.id === member.id || m.profile.name.toLowerCase() === member.profile.name.toLowerCase()
    );

    if (!targetMember) {
      targetMember = useMockStore.getState().addServerMember(server.id, member.profile.name);
    }

    if (!targetMember) return;

    useMockStore.getState().openConversation(server.id, targetMember.id);
    navigate(`/servers/${server.id}/conversations/${targetMember.id}`);
  };

  const servers = useMockStore((state) => state.servers);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const activeServer = servers.find((s) => s.id === params?.serverId) || servers[0];
  const liveMember =
    activeServer?.members.find(
      (item) =>
        item.id === member.id ||
        item.profile.name.toLowerCase() === member.profile.name.toLowerCase()
    ) || member;
  const isSelfMember =
    liveMember.profileId === currentProfile.id ||
    liveMember.profile.name.toLowerCase() === currentMember?.profile?.name?.toLowerCase();
  const avatarUrl = (isSelfMember ? activeServer?.avatarUrl : undefined) || liveMember.profile.imageUrl || member.profile.imageUrl;
  const displayName = getMemberDisplayName(member, activeServer);

  const myNicks = useMemo(() => {
    return Array.from(
      new Set(
        [
          ...(activeServer?.nicknames || []),
          currentMember?.profile?.name,
          currentProfile?.name,
        ].filter(Boolean) as string[]
      )
    );
  }, [activeServer?.nicknames, currentMember?.profile?.name, currentProfile?.name]);

  const allMemberNicks = useMemo(() => {
    return (activeServer?.members || []).map((m) => m.profile.name).filter(Boolean);
  }, [activeServer?.members]);

  const isSelf = useMemo(() => {
    if (!member) return false;
    const senderName = member.profile?.name?.toLowerCase();
    const isCurrentMemberId = member.id === currentMember?.id || member.profileId === currentMember?.profileId;
    if (isCurrentMemberId) return true;
    return myNicks.some((n) => n.toLowerCase() === senderName);
  }, [member, currentMember, myNicks]);

  const isMention = useMemo(() => {
    if (isSystem || deleted || isSelf || !content) return false;
    return checkIsMention(content, myNicks);
  }, [content, isSystem, deleted, isSelf, myNicks]);

  const hasBrokenHeader = isBrokenHeader(content);
  const cleanContent = stripSteganography(content).replace(/\u0085/g, "\n");

  const urlRegex = /(https?:\/\/[^\s]+)/g;

  const isAction = typeof cleanContent === "string" && /^\x01ACTION ([\s\S]*)\x01?$/i.test(cleanContent.trim());
  const actionText = isAction
    ? cleanContent.trim().replace(/^\x01ACTION /i, "").replace(/\x01$/, "").trim()
    : cleanContent;

  // Check if there is any visible text remaining after hiding image URLs
  const textToEvaluate = isAction ? actionText : cleanContent;

  // Markdown vs legacy rendering — only when markdown chars present and block is not broken
  const shouldUseMarkdown = enableMarkdown && !deleted && !isSystem && !isAction && !hasBrokenHeader && hasMarkdownSyntax(textToEvaluate);

  // Detect messages containing only emojis for Discord-style Jumboji enlarged rendering
  const emojiCount = !deleted && !isSystem && !isAction && !fileUrl ? getOnlyEmojiCount(cleanContent) : 0;
  const isOnlyEmoji = jumbojiSize > 0 && emojiCount > 0 && emojiCount <= 16;
  const emojiSizeProps = getEmojiSizeProps(emojiCount, jumbojiSize);

  const parseMentions = (text: string, keyPrefix: string | number) => {
    if (!text) return text;
    const myNicksLower = new Set(myNicks.map((n) => n.toLowerCase()));
    const allNicksLower = new Set(allMemberNicks.map((n) => n.toLowerCase()));

    const escapedMyNicks = myNicks
      .filter(Boolean)
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    const regexPattern =
      `(@[a-zA-Z0-9_\\-\\[\\]\\\`^{}|]+)` +
      (escapedMyNicks.length > 0
        ? `|(\\b(?:${escapedMyNicks.join("|")})(?:[:,]?(?=\\s|$)|\\b))`
        : "");

    if (!regexPattern) return text;

    const regex = new RegExp(regexPattern, "gi");
    let match: RegExpExecArray | null;
    let lastIndex = 0;
    const elements: (string | React.ReactNode)[] = [];

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        elements.push(text.slice(lastIndex, match.index));
      }

      const matchedStr = match[0];
      const cleanNick = matchedStr.replace(/^@/, "").replace(/[:,]$/, "").toLowerCase();
      const isMyMention = myNicksLower.has(cleanNick);
      const isMemberMention = isMyMention || allNicksLower.has(cleanNick) || matchedStr.startsWith("@");

      if (isMemberMention) {
        elements.push(
          <span
            key={`mention-${keyPrefix}-${match.index}`}
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold transition-colors mx-0.5 select-none",
              isMyMention
                ? "bg-amber-500/25 dark:bg-amber-500/35 text-amber-900 dark:text-amber-200 border border-amber-500/30"
                : "bg-indigo-500/15 dark:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20"
            )}
          >
            {matchedStr}
          </span>
        );
      } else {
        elements.push(matchedStr);
      }

      lastIndex = match.index + matchedStr.length;
    }

    if (lastIndex < text.length) {
      elements.push(text.slice(lastIndex));
    }

    return elements.length > 0 ? elements : text;
  };

  const renderContentWithLinks = (text: string) => {
    if (deleted) return text;
    const parts = text.split(urlRegex);
    return parts.map((part, index) => {
      if (part.match(urlRegex)) {
        if (enableLinkPreviews && isMediaUrl(part)) {
          // Hide raw media (image or video) URL text because it will be rendered as a media card below
          return null;
        }
        return (
          <button
            key={index}
            type="button"
            onClick={() => openExternalUrl(part)}
            className="text-indigo-500 dark:text-indigo-400 hover:underline break-all inline text-left p-0 bg-transparent border-none font-normal"
          >
            {part}
          </button>
        );
      }
      return parseMentions(part, index);
    });
  };

  let renderedElements: any = null;
  let hasVisibleText = false;
  let extractedUrls: string[] = [];

  if (shouldUseMarkdown) {
    // Extract URLs excluding code blocks/inline code
    const markdownUrls = enableLinkPreviews && !fileUrl ? extractUrlsFromMarkdownText(textToEvaluate) : [];
    extractedUrls = markdownUrls;
    // Determine visible text after stripping media URLs (if previews enabled)
    const trimmed = textToEvaluate.trim();
    if (trimmed.length === 0) {
      hasVisibleText = false;
    } else if (enableLinkPreviews && extractedUrls.length === 1 && trimmed === extractedUrls[0] && isMediaUrl(extractedUrls[0])) {
      // Single media URL only — hide markdown text (preview will show)
      hasVisibleText = false;
    } else if (enableLinkPreviews) {
      // Check if remaining text after removing media URLs is non-empty
      let stripped = textToEvaluate;
      extractedUrls.forEach((u) => {
        if (isMediaUrl(u)) stripped = stripped.split(u).join(" ");
      });
      // Also strip code blocks for visibility check? Keep as visible
      hasVisibleText = stripped.trim().length > 0;
      // If stripped is empty but there were non-media URLs, still visible (markdown links)
      if (!hasVisibleText && extractedUrls.some((u) => !isMediaUrl(u))) {
        hasVisibleText = true;
      }
      // If no media urls, default to true if trimmed not empty
      if (extractedUrls.length === 0) hasVisibleText = trimmed.length > 0;
    } else {
      hasVisibleText = trimmed.length > 0;
    }
    // For markdown we don't need renderedElements array, but keep flag
    renderedElements = hasVisibleText ? true : null;
  } else {
    renderedElements = renderContentWithLinks(textToEvaluate);
    hasVisibleText = Array.isArray(renderedElements)
      ? renderedElements.some((item) => item !== null && typeof item === "string" ? item.trim().length > 0 : item !== null)
      : Boolean(renderedElements);
    extractedUrls = enableLinkPreviews && !deleted && !fileUrl
      ? Array.from(new Set(textToEvaluate.match(urlRegex) || []))
      : [];
    if (extractedUrls.length > 0) {
      extractedUrls = Array.from(new Set(extractedUrls.map((u: string) => stripTrailingPunct(u))));
    }
  }

  if (isSystem) {
    return (
      <div className="relative group flex items-center px-4 py-1 transition w-full">
        <div className="w-10 flex justify-center shrink-0">
          <ActionTooltip label={timestamp}>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono select-none">
              {compactTime}
            </span>
          </ActionTooltip>
        </div>
        <p className="text-sm text-zinc-500 italic ml-2">
          {content}
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      "relative group flex items-center px-4 transition w-full border-l-[3px]",
      compact ? "py-[2px]" : "pt-2.5 pb-[2px]",
      isMention
        ? "bg-amber-500/10 hover:bg-amber-500/15 dark:bg-amber-500/15 dark:hover:bg-amber-500/20 border-amber-500"
        : "border-transparent"
    )}>
      <div className="group flex gap-x-2 items-start w-full min-w-0">
        {!compactMode && !compact ? (
          <UserHoverCard member={member} server={activeServer} side="right">
            <div onClick={onMemberClick} className="cursor-pointer hover:drop-shadow-md transition shrink-0">
              <UserAvatar src={avatarUrl} name={displayName} className="h-10 w-10 md:h-10 md:w-10" />
            </div>
          </UserHoverCard>
        ) : !compactMode && compact ? (
          <div className="w-10 h-5 flex items-center justify-center shrink-0">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 hidden group-hover:block select-none font-mono">
              {compactTime}
            </span>
          </div>
        ) : null}
        <div className="flex flex-col w-full min-w-0">
          {(replyMeta?.nick || replyMeta?.preview) && (
            <button
              type="button"
              onClick={() => {
                if (replyMeta?.messageId) {
                  focusChatMessage(replyMeta.messageId);
                }
              }}
              className="mb-1 flex items-start gap-x-2 max-w-full text-left group/reply"
            >
              <div className="w-0.5 self-stretch rounded-full bg-indigo-500/80 shrink-0" />
              <div className="min-w-0 flex flex-col">
                <span className="text-xs font-semibold text-indigo-500 dark:text-indigo-400 truncate">
                  {replyMeta.nick}
                </span>
                <span className="text-xs italic text-zinc-500 dark:text-zinc-400 truncate group-hover/reply:text-zinc-700 dark:group-hover/reply:text-zinc-300 transition">
                  {replyMeta.preview}
                </span>
              </div>
            </button>
          )}
          {!compact && (
            <div className="flex items-center gap-x-2">
              {!isAction && (
                <div className="flex items-center">
                  <UserHoverCard member={member} server={activeServer} side="right">
                    <p onClick={onMemberClick} className="font-semibold text-sm hover:underline cursor-pointer text-zinc-800 dark:text-zinc-100">
                      {displayName}
                    </p>
                  </UserHoverCard>
                </div>
              )}
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {timestamp}
              </span>
            </div>
          )}

          {fileUrl && (
            <ChatItemAttachment
              fileUrl={fileUrl}
              content={content}
              onContentSizeChange={onContentSizeChange}
            />
          )}

          {!fileUrl && (
            <div className="space-y-1 min-w-0 w-full">
              {(hasVisibleText || deleted) && (
                hasBrokenHeader ? (
                  <div className="flex items-center gap-x-2 my-0.5">
                    <ActionTooltip label="Incomplete code block: transmission was interrupted or dropped by IRC server">
                      <div className="inline-flex items-center gap-x-2 px-2.5 py-1 rounded bg-rose-500/15 dark:bg-rose-500/20 border border-rose-500/30 text-rose-700 dark:text-rose-300 font-mono text-xs font-semibold cursor-help select-none">
                        <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                        <span>{textToEvaluate}</span>
                      </div>
                    </ActionTooltip>
                  </div>
                ) : isAction ? (
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 italic">
                    <span className="font-bold text-indigo-500 dark:text-indigo-400 not-italic mr-1.5">*</span>
                    <UserHoverCard member={member} server={activeServer} side="right">
                      <span onClick={onMemberClick} className="font-semibold not-italic hover:underline cursor-pointer text-zinc-800 dark:text-zinc-100 mr-1.5">
                        {displayName}
                      </span>
                    </UserHoverCard>
                    <span>{renderContentWithLinks(actionText)}</span>
                  </p>
                ) : shouldUseMarkdown && !isOnlyEmoji ? (
                  <div className={cn(
                    "text-sm text-zinc-600 dark:text-zinc-300 min-w-0 w-full",
                    deleted && "italic text-zinc-500 dark:text-zinc-400 text-xs mt-1"
                  )}>
                    <MarkdownRenderer
                      content={cleanContent}
                      onContentSizeChange={onContentSizeChange}
                      compact={compact}
                      myNicks={myNicks}
                      allMemberNicks={allMemberNicks}
                    />
                  </div>
                ) : (
                  <p
                    style={isOnlyEmoji ? emojiSizeProps.style : undefined}
                    className={cn(
                      "text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-wrap break-words",
                      isOnlyEmoji && emojiSizeProps.className,
                      deleted && "italic text-zinc-500 dark:text-zinc-400 text-xs mt-1"
                    )}
                  >
                    {renderContentWithLinks(cleanContent)}
                  </p>
                )
              )}
              {extractedUrls.map((url) => (
                <LinkPreview
                  key={url}
                  url={url}
                  onContentSizeChange={onContentSizeChange}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {!deleted && !isSystem && (
        <div className="hidden group-hover:flex items-center gap-x-2 absolute p-1 -top-2 right-5 bg-white dark:bg-zinc-800 border rounded-sm">
          <ActionTooltip label="Answer">
            <button
              type="button"
              onClick={handleReply}
              className="p-0.5 rounded-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
            >
              <Reply
                className="cursor-pointer w-4 h-4 text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition"
              />
            </button>
          </ActionTooltip>
        </div>
      )}
    </div>
  );
};

export const ChatItem = memo(ChatItemInner, (prev, next) =>
  prev.id === next.id &&
  prev.content === next.content &&
  prev.deleted === next.deleted &&
  prev.fileUrl === next.fileUrl &&
  prev.isSystem === next.isSystem &&
  prev.compact === next.compact &&
  prev.timestamp === next.timestamp &&
  prev.compactTime === next.compactTime &&
  prev.ircMsgid === next.ircMsgid &&
  prev.messageOffset === next.messageOffset &&
  prev.replyTo?.messageId === next.replyTo?.messageId &&
  prev.replyTo?.nick === next.replyTo?.nick &&
  prev.replyTo?.preview === next.replyTo?.preview &&
  prev.member?.id === next.member?.id &&
  prev.currentMember?.id === next.currentMember?.id &&
  prev.onContentSizeChange === next.onContentSizeChange
);
