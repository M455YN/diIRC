import * as z from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Paperclip, Loader2, X, FileIcon, Command, Radio, User, Users, Bold, Italic, Underline, Strikethrough, GripHorizontal, EyeOff, MoreHorizontal, Code, SquareCode, Heading, Quote, List, ListOrdered } from "lucide-react";
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { readImage } from "@tauri-apps/plugin-clipboard-manager";
import { readFile } from "@tauri-apps/plugin-fs";
import { useNavigate } from "react-router-dom";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useModal } from "@/hooks/use-modal-store";
import { EmojiPicker } from "@/components/emoji-picker";
import { Member } from "@/types";
import { useMockStore, getServerSelfMember, getServerActiveNick, formatNickCompletion } from "@/lib/mock-store";
import { UserRoleIcon, getHighestChannelRole, ROLE_CONFIGS, UserRoleKey } from "@/components/user-role-icon";
import { UserAvatar } from "@/components/user-avatar";
import { uploadImage } from "@/lib/upload/services";
import { ImageContextMenu } from "@/components/image-context-menu";
import { isMediaUrl } from "@/lib/image-utils";
import { cn } from "@/lib/utils";
import { commandRegistry, expandCustomCommand, listSlashSuggestions } from "@/lib/commands/command-system";
import { useDraftStore, AttachedImage } from "@/hooks/use-draft-store";
import { formatCompatReply, replyTagOverheadBytes, useReplyStore } from "@/hooks/use-reply-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toggleMarkdownWrap, hasMarkdownSyntax, isMarkdownFormatActive, wrapCodeBlock, toggleLinePrefix, toggleHeadingPrefix, dedentCode } from "@/lib/markdown/markdown-utils";
import { MarkdownRenderer } from "@/lib/markdown/markdown-renderer";
import { ActionTooltip } from "@/components/action-tooltip";

const MARKDOWN_FORMATS = [
  { id: "bold", icon: Bold, before: "**", after: "**", label: "Bold (Ctrl+B)", shortcut: "b", shift: false },
  { id: "italic", icon: Italic, before: "*", after: "*", label: "Italic (Ctrl+I)", shortcut: "i", shift: false },
  { id: "underline", icon: Underline, before: "__", after: "__", label: "Underline (Ctrl+U)", shortcut: "u", shift: false },
  { id: "strikethrough", icon: Strikethrough, before: "~~", after: "~~", label: "Strikethrough (Ctrl+Shift+X)", shortcut: "x", shift: true },
  { id: "spoiler", icon: EyeOff, before: "||", after: "||", label: "Spoiler (Ctrl+Shift+H)", shortcut: "h", shift: true },
] as const;

const EXTRA_MARKDOWN_ACTIONS = [
  { id: "code-block", label: "Code block", icon: Code, apply: (textarea: HTMLTextAreaElement) => wrapCodeBlock(textarea) },
  { id: "quote", label: "Quote", icon: Quote, apply: (textarea: HTMLTextAreaElement) => toggleLinePrefix(textarea, "> ") },
  { id: "bullet-list", label: "Bullet list", icon: List, apply: (textarea: HTMLTextAreaElement) => toggleLinePrefix(textarea, "- ") },
  { id: "numbered-list", label: "Numbered list", icon: ListOrdered, apply: (textarea: HTMLTextAreaElement) => toggleLinePrefix(textarea, "", { numbered: true }) },
] as const;

const HEADING_LEVELS = [
  { level: 1 as const, label: "Heading 1", preview: "#" },
  { level: 2 as const, label: "Heading 2", preview: "##" },
  { level: 3 as const, label: "Heading 3", preview: "###" },
] as const;

const INPUT_UNDO_LIMIT = 100;

const FORMATTING_PREVIEW_HEIGHT_DEFAULT = 88;
const FORMATTING_PREVIEW_HEIGHT_MIN = 56;
const FORMATTING_PREVIEW_HEIGHT_MAX = 320;

import { getIrcByteCount, getIrcMaxMessageBytes } from "@/lib/system-utils";
export { getIrcByteCount, getIrcMaxMessageBytes };

interface ChatInputProps {
  query: Record<string, string>;
  name: string;
  type: "conversation" | "channel";
}

const formSchema = z.object({
  content: z.string().optional().default(""),
});

export const ChatInput = ({
  query,
  name,
  type,
}: ChatInputProps) => {
  const addMessage = useMockStore((state) => state.addMessage);
  const addDirectMessage = useMockStore((state) => state.addDirectMessage);
  const markTailSeen = useMockStore((state) => state.markTailSeen);
  const clearUnreadMarker = useMockStore((state) => state.clearUnreadMarker);
  const setTailPinned = useMockStore((state) => state.setTailPinned);
  const servers = useMockStore((state) => state.servers);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const uploadConfig = useMockStore((state) => state.uploadConfig);
  const ircConnectedServers = useMockStore((state) => state.ircConnectedServers);
  const ircConnectingServers = useMockStore((state) => state.ircConnectingServers);
  const connectServer = useMockStore((state) => state.connectServer);
  const enableCommandSuggestions = useMockStore((state) => state.enableCommandSuggestions ?? true);
  const enableMarkdown = useMockStore((state) => state.enableMarkdown ?? true);
  const enableFormattingPreview = useMockStore((state) => state.enableFormattingPreview ?? true);
  const { onOpen } = useModal();
  const navigate = useNavigate();

  const [localConnecting, setLocalConnecting] = useState(false);

  const activeId = query?.channelId || query?.conversationId;

  const setDraft = useDraftStore((state) => state.setDraft);
  const getDraft = useDraftStore((state) => state.getDraft);
  const clearDraft = useDraftStore((state) => state.clearDraft);
  const pendingReply = useReplyStore((state) =>
    activeId ? state.pendingByChatId[activeId] : undefined
  );
  const clearPendingReply = useReplyStore((state) => state.clearPending);
  const rememberSentReply = useReplyStore((state) => state.rememberSent);

  const initialDraft = activeId ? getDraft(activeId) : { content: "", attachedImages: [] };

  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>(initialDraft.attachedImages || []);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const undoStackRef = useRef<string[]>([]);
  const redoStackRef = useRef<string[]>([]);
  const isUndoRedoRef = useRef(false);

  const [showCommands, setShowCommands] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [isFocused, setIsFocused] = useState(true);
  const commandListRef = useRef<HTMLDivElement>(null);
  const [formattingPreviewHeight, setFormattingPreviewHeight] = useState(FORMATTING_PREVIEW_HEIGHT_DEFAULT);
  const [selectionRange, setSelectionRange] = useState({ start: 0, end: 0 });

  const channelModesMap = useMockStore((state) => state.channelModes);
  const channelUserModesMap = useMockStore((state) => state.channelUserModes);
  const channelMembersMap = useMockStore((state) => state.channelMembers);
  const nickCompletionFormat = useMockStore((state) => state.nickCompletionFormat || "plain");
  const customNickCompletionFormat = useMockStore((state) => state.customNickCompletionFormat || "{nick}: ");
  
  const currentChannelModes = (type === "channel" && activeId) ? (channelModesMap[activeId] || []) : [];
  const isModerated = currentChannelModes.includes("m");

  const activeServer = query?.serverId ? servers.find((s) => s.id === query.serverId) : (servers[0] || null);

  let currentMember = activeServer ? getServerSelfMember(activeServer, currentProfile.id) : undefined;

  const primaryNick = activeServer ? getServerActiveNick(activeServer) : undefined;
  if (primaryNick && currentMember) {
    currentMember = {
      ...currentMember,
      profile: {
        ...currentMember.profile,
        name: primaryNick,
      },
    };
  }

  const currentUserModes = (type === "channel" && activeId && currentMember) ? (channelUserModesMap[activeId]?.[currentMember.profile.name.toLowerCase()] || []) : [];
  const hasVoiceOrHigher = getHighestChannelRole(currentUserModes) !== null;

  const isMuted = type === "channel" && isModerated && !hasVoiceOrHigher;

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: initialDraft.content || "",
    }
  });

  const prevActiveIdRef = useRef<string | undefined>(undefined);
  const isSwitchingRef = useRef<boolean>(false);
  const attachedImagesRef = useRef(attachedImages);
  attachedImagesRef.current = attachedImages;

  const isIrcConnected = activeServer ? !!ircConnectedServers[activeServer.id] : true;
  const isUploading = attachedImages.some((img) => img.isUploading);
  const isLoading = isUploading || !isIrcConnected || isMuted;
  const isInputDisabled = !isIrcConnected || isMuted;

  const autoResize = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const newHeight = Math.min(ta.scrollHeight, 120);
    ta.style.height = `${newHeight}px`;
  }, []);

  const focusInput = useCallback(() => {
    textareaRef.current?.focus();
    setTimeout(() => {
      textareaRef.current?.focus();
      form.setFocus("content");
      autoResize();
    }, 0);
  }, [form, autoResize]);

  useEffect(() => {
    if (!activeId) return;

    setShowNickMenu(false);
    setNickQueryInfo(null);

    isSwitchingRef.current = true;

    const prevId = prevActiveIdRef.current;
    if (prevId && prevId !== activeId) {
      const currentContent = form.getValues("content") || "";
      setDraft(prevId, {
        content: currentContent,
        attachedImages: attachedImagesRef.current,
      });
    }

    const draft = getDraft(activeId);
    form.reset({ content: draft.content || "" });
    setAttachedImages(draft.attachedImages || []);

    prevActiveIdRef.current = activeId;

    undoStackRef.current = [];
    redoStackRef.current = [];
    isUndoRedoRef.current = false;

    focusInput();

    const timer = setTimeout(() => {
      isSwitchingRef.current = false;
    }, 0);
    return () => clearTimeout(timer);
  }, [activeId, form, getDraft, setDraft, focusInput]);

  const content = form.watch("content") || "";
  const showFormattingPreview =
    enableMarkdown &&
    enableFormattingPreview &&
    Boolean(content.trim()) &&
    !content.trim().startsWith("/") &&
    hasMarkdownSyntax(content);

  const activeFormatIds = useMemo(() => {
    if (!enableMarkdown) return new Set<string>();
    return new Set(
      MARKDOWN_FORMATS.filter((format) =>
        isMarkdownFormatActive(content, selectionRange.start, selectionRange.end, format.before, format.after)
      ).map((format) => format.id)
    );
  }, [content, selectionRange, enableMarkdown]);

  const pushUndoState = useCallback((previousValue: string) => {
    undoStackRef.current.push(previousValue);
    if (undoStackRef.current.length > INPUT_UNDO_LIMIT) {
      undoStackRef.current.shift();
    }
    redoStackRef.current = [];
  }, []);

  const updateSelection = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    setSelectionRange({
      start: textarea.selectionStart,
      end: textarea.selectionEnd,
    });
  }, []);

  const targetName = type === "channel" ? (name.startsWith("#") ? name : `#${name}`) : name;
  const currentNick = primaryNick || currentMember?.profile?.name || "You";
  const serverHost = activeServer?.host || "localhost";
  const serverUser = activeServer?.realname || currentNick;

  const maxBytes = getIrcMaxMessageBytes(targetName, currentNick, serverUser, serverHost);
  const wireBytesFor = useCallback(
    (text: string) => {
      if (!pendingReply || text.trim().startsWith("/")) {
        return getIrcByteCount(text);
      }
      const tagBytes = replyTagOverheadBytes(pendingReply.msgid);
      const bodyBudget = Math.max(0, maxBytes - tagBytes);
      const wire = formatCompatReply(
        pendingReply.nick,
        pendingReply.preview,
        text,
        bodyBudget
      );
      return getIrcByteCount(wire) + tagBytes;
    },
    [pendingReply, maxBytes]
  );
  const currentBytes = wireBytesFor(content);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const rawPasteText = e.clipboardData.getData("text");
    if (!rawPasteText) return;

    const pasteText = dedentCode(rawPasteText);
    const textarea = e.currentTarget;
    const selectionStart = textarea.selectionStart ?? 0;
    const selectionEnd = textarea.selectionEnd ?? 0;
    const currentVal = form.getValues("content") || "";

    const nextVal = currentVal.slice(0, selectionStart) + pasteText + currentVal.slice(selectionEnd);
    const nextBytes = wireBytesFor(nextVal);

    if (nextBytes > maxBytes) {
      e.preventDefault();
      onOpen("ircError", {
        title: "Message length limit exceeded",
        description: `Pasted message exceeds the maximum allowed limit of ${maxBytes} bytes (attempted paste size: ${nextBytes} bytes).`,
      });
      return;
    }

    if (pasteText !== rawPasteText) {
      e.preventDefault();
      form.setValue("content", nextVal, { shouldDirty: true });
      const newPos = selectionStart + pasteText.length;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newPos, newPos);
        }
        autoResize();
      }, 0);
    }
  };

  useEffect(() => {
    if (!activeId || isSwitchingRef.current) return;
    if (prevActiveIdRef.current !== activeId) return;

    setDraft(activeId, {
      content: content || "",
      attachedImages: attachedImages,
    });
  }, [content, attachedImages, activeId, setDraft]);

  useEffect(() => {
    const handleRestore = (e: Event) => {
      const customEvent = e as CustomEvent<{ id: string; content: string }>;
      if (customEvent.detail && customEvent.detail.id === activeId) {
        form.setValue("content", customEvent.detail.content);
        focusInput();
      }
    };
    const handleFocusInput = (e: Event) => {
      const customEvent = e as CustomEvent<{ chatId?: string }>;
      if (!customEvent.detail?.chatId || customEvent.detail.chatId === activeId) {
        focusInput();
      }
    };
    window.addEventListener("restore_unsent_message", handleRestore);
    window.addEventListener("focus_chat_input", handleFocusInput);
    return () => {
      window.removeEventListener("restore_unsent_message", handleRestore);
      window.removeEventListener("focus_chat_input", handleFocusInput);
    };
  }, [activeId, form, focusInput]);

  useEffect(() => {
    if (enableCommandSuggestions && isFocused && content?.startsWith("/")) {
      const active = query?.serverId
        ? servers.find((s) => s.id === query.serverId)
        : servers[0];
      const items = listSlashSuggestions(content, active?.customCommands);
      if (items.length > 0) {
        setShowCommands(true);
        setSelectedCommandIndex(0);
      } else {
        setShowCommands(false);
      }
    } else {
      setShowCommands(false);
    }
  }, [content, enableCommandSuggestions, isFocused, query?.serverId, servers]);

  const filteredCommands = (() => {
    if (!content?.startsWith("/")) return [];
    const active = query?.serverId
      ? servers.find((s) => s.id === query.serverId)
      : servers[0];
    return listSlashSuggestions(content, active?.customCommands);
  })();

  const removeAttachment = useCallback((id: string) => {
    setAttachedImages((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((item) => item.id !== id);
    });
  }, []);

  const clearAllAttachments = useCallback(() => {
    setAttachedImages((prev) => {
      prev.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
      return [];
    });
  }, []);

  const processFileUpload = useCallback(async (file: File) => {
    if (uploadConfig.provider === "disabled") {
      setUploadError("Uploading is disabled in settings. Enable an upload provider in Settings.");
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    const id = `img-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
    const previewUrl = URL.createObjectURL(file);

    setAttachedImages((prev) => [
      ...prev,
      {
        id,
        previewUrl,
        name: file.name,
        isUploading: true,
      },
    ]);
    setUploadError(null);

    try {
      const url = await uploadImage(file, uploadConfig);
      setAttachedImages((prev) =>
        prev.map((item) => (item.id === id ? { ...item, url, isUploading: false } : item))
      );
      focusInput();
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err?.message || "Failed to upload file.");
      setAttachedImages((prev) => prev.filter((item) => item.id !== id));
      URL.revokeObjectURL(previewUrl);
      setTimeout(() => setUploadError(null), 5000);
    }
  }, [uploadConfig, focusInput]);

  const processFilePathUpload = useCallback(async (filePath: string) => {
    if (uploadConfig.provider === "disabled") {
      setUploadError("Uploading is disabled in settings. Enable an upload provider in Settings.");
      setTimeout(() => setUploadError(null), 5000);
      return;
    }

    try {
      const fileBytes = await readFile(filePath);
      const fileName = filePath.split(/[/\\]/).pop() || "file";
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      const mimeMap: Record<string, string> = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        gif: "image/gif",
        webp: "image/webp",
        bmp: "image/bmp",
        svg: "image/svg+xml",
        ico: "image/x-icon",
        mp4: "video/mp4",
        webm: "video/webm",
        mov: "video/quicktime",
        m4v: "video/x-m4v",
        mkv: "video/x-matroska",
        mp3: "audio/mpeg",
        wav: "audio/wav",
        ogg: "audio/ogg",
        pdf: "application/pdf",
        zip: "application/zip",
        rar: "application/vnd.rar",
        "7z": "application/x-7z-compressed",
        tar: "application/x-tar",
        gz: "application/gzip",
        txt: "text/plain",
        json: "application/json",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        xls: "application/vnd.ms-excel",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
      const mimeType = mimeMap[ext] || "application/octet-stream";

      const file = new File([fileBytes], fileName, { type: mimeType });
      await processFileUpload(file);
    } catch (err: any) {
      console.error("File path upload error:", err);
      setUploadError(err?.message || "Failed to upload file.");
      setTimeout(() => setUploadError(null), 5000);
    }
  }, [uploadConfig, processFileUpload]);

  useEffect(() => {
    return () => {
      attachedImagesRef.current.forEach((img) => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
      });
    };
  }, []);

  const lastPasteTimeRef = useRef<number>(0);

  const processClipboardPaste = useCallback(async (pastedFile?: File) => {
    if (uploadConfig.provider === "disabled") return;

    const now = Date.now();
    if (now - lastPasteTimeRef.current < 300) return;
    lastPasteTimeRef.current = now;

    if (pastedFile) {
      await processFileUpload(pastedFile);
      return;
    }

    try {
      const clipImage = await readImage();
      if (!clipImage) return;

      const size = await clipImage.size();
      const rgbaData = await clipImage.rgba();
      if (!rgbaData || rgbaData.length === 0 || !size.width || !size.height) return;

      const canvas = document.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const imgData = ctx.createImageData(size.width, size.height);
      imgData.data.set(rgbaData);
      ctx.putImageData(imgData, 0, 0);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) return;

      const file = new File([blob], `clipboard-${Date.now()}.png`, { type: "image/png" });

      await processFileUpload(file);
    } catch (err: any) {
      console.debug("Clipboard paste (no image file):", err?.message);
    }
  }, [uploadConfig, processFileUpload]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupDragDrop = async () => {
      try {
        const appWindow = getCurrentWebviewWindow();
        unlisten = await appWindow.onDragDropEvent((event) => {
          if (event.payload.type === "drop") {
            const paths = event.payload.paths;
            if (paths && paths.length > 0) {
              paths.forEach((path) => processFilePathUpload(path));
            }
          }
        });
      } catch (err) {
        console.error("Failed to setup drag-drop listener:", err);
      }
    };

    setupDragDrop();

    return () => {
      if (unlisten) unlisten();
    };
  }, [processFilePathUpload]);

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
          const file = items[i].getAsFile();
          if (file) {
            processClipboardPaste(file);
            break;
          }
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        setTimeout(() => {
          processClipboardPaste();
        }, 50);
      }
    };

    window.addEventListener("paste", handlePaste);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("paste", handlePaste);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [processClipboardPaste]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach((file) => processFileUpload(file));
    if (e.target) {
      e.target.value = "";
    }
  };

  const createCommandContext = useCallback((onInputUpdated?: () => void) => {
    const activeServer = query?.serverId ? servers.find((s) => s.id === query.serverId) : (servers[0] || null);
    if (!activeServer) return null;

    const senderMember: Member = currentMember
      ? {
          ...currentMember,
          profile: {
            ...currentMember.profile,
            name: primaryNick || currentMember.profile.name,
          },
        }
      : {
          id: `self-${activeServer.id}`,
          profileId: currentProfile.id,
          profile: {
            ...currentProfile,
            name: primaryNick || currentProfile.name,
          },
          serverId: activeServer.id,
        };

    return {
      serverId: activeServer.id,
      channelName: name,
      channelId: query?.channelId,
      conversationId: query?.conversationId,
      targetMemberId: query?.targetMemberId,
      type,
      currentMember: senderMember,
      activeServer,
      addMessage,
      addDirectMessage,
      navigate,
      setInputContent: (newContent: string, cursorPosition?: number) => {
        if (onInputUpdated) onInputUpdated();
        form.setValue("content", newContent);
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            if (typeof cursorPosition === "number") {
              textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
            }
          }
          autoResize();
        }, 0);
      },
    };
  }, [
    query,
    servers,
    currentMember,
    primaryNick,
    currentProfile,
    name,
    type,
    addMessage,
    addDirectMessage,
    navigate,
    form,
    autoResize,
  ]);

  const onCommandSelect = (insert: string) => {
    form.setValue("content", insert);
    form.setFocus("content");
    setShowCommands(false);
  };

  const [showNickMenu, setShowNickMenu] = useState(false);
  const [selectedNickIndex, setSelectedNickIndex] = useState(0);
  const [nickSuggestions, setNickSuggestions] = useState<{
    nick: string;
    roleKey: UserRoleKey | null;
    roleLabel: string;
    avatarUrl?: string;
  }[]>([]);
  const [nickQueryInfo, setNickQueryInfo] = useState<{
    queryWord: string;
    startIndex: number;
    endIndex: number;
    isStartOfMessage: boolean;
  } | null>(null);
  const nickListRef = useRef<HTMLDivElement>(null);

  const getChannelNicknames = useCallback((): string[] => {
    const activeServer = query?.serverId ? servers.find((s) => s.id === query.serverId) : servers[0];
    if (!activeServer) return [];
    const nicksSet = new Set<string>();

    const isIgnoredNick = (nick: string) => {
      const lower = nick.toLowerCase().trim();
      return (
        !lower ||
        lower.startsWith("*") ||
        lower === "_status" ||
        lower === "*status" ||
        lower === "status" ||
        lower === "*nickserv" ||
        lower === "*chanserv" ||
        lower === "*sasl" ||
        lower === "*control"
      );
    };

    if (type === "channel" && activeId) {
      const channelNicks = channelMembersMap[activeId];
      if (channelNicks && channelNicks.length > 0) {
        for (const n of channelNicks) {
          if (n && !isIgnoredNick(n)) {
            nicksSet.add(n.trim());
          }
        }
      }
    } else if (type === "conversation") {
      if (activeServer.members) {
        for (const m of activeServer.members) {
          const name = m.profile?.name;
          if (name && !isIgnoredNick(name)) {
            nicksSet.add(name.trim());
          }
        }
      }
    }

    const ourNick = getServerActiveNick(activeServer).toLowerCase();
    const sortedNicks = Array.from(nicksSet).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
    return sortedNicks.filter((n) => n.toLowerCase() !== ourNick);
  }, [servers, query?.serverId, type, activeId, channelMembersMap]);

  const onNickSelect = useCallback(
    (
      selectedNick: string,
      overrideInfo?: { startIndex: number; endIndex: number; isStartOfMessage: boolean }
    ) => {
      const textarea = textareaRef.current;
      const currentText = form.getValues("content") || "";
      const info = overrideInfo || nickQueryInfo;

      let startIndex = textarea ? textarea.selectionStart : currentText.length;
      let endIndex = startIndex;

      if (info) {
        startIndex = info.startIndex;
        endIndex = info.endIndex;
      }

      // Format nickname according to configured settings (plain, colon, comma, @, custom, etc.)
      const replacement = formatNickCompletion(selectedNick, nickCompletionFormat, customNickCompletionFormat);

      const newContent =
        currentText.slice(0, startIndex) +
        replacement +
        currentText.slice(endIndex);

      form.setValue("content", newContent, { shouldDirty: true });
      setShowNickMenu(false);
      setNickQueryInfo(null);

      const newCursorPos = startIndex + replacement.length;
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
        }
        autoResize();
      }, 0);
    },
    [form, nickQueryInfo, nickCompletionFormat, customNickCompletionFormat, autoResize]
  );

  const openNickSuggestionsMenu = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const currentText = form.getValues("content") || "";
    const cursorPos = textarea.selectionStart ?? currentText.length;
    const textBeforeCursor = currentText.slice(0, cursorPos);

    const match = textBeforeCursor.match(/([^\s]+)$/);
    const rawWord = match ? match[1] : "";
    const wordStartIndex = match ? cursorPos - rawWord.length : cursorPos;
    const isStartOfMessage = textBeforeCursor.slice(0, wordStartIndex).trim().length === 0;

    const allNicks = getChannelNicknames();
    if (allNicks.length === 0) {
      setShowNickMenu(false);
      return;
    }

    const filtered = rawWord
      ? allNicks.filter((n) => n.toLowerCase().startsWith(rawWord.toLowerCase()))
      : allNicks;

    if (filtered.length === 0) {
      setShowNickMenu(false);
      return;
    }

    if (filtered.length === 1) {
      onNickSelect(filtered[0], {
        startIndex: wordStartIndex,
        endIndex: cursorPos,
        isStartOfMessage,
      });
      return;
    }

    const activeServer = query?.serverId ? servers.find((s) => s.id === query.serverId) : servers[0];
    const suggestions = filtered.map((n) => {
      const modes = (type === "channel" && activeId) ? (channelUserModesMap[activeId]?.[n.toLowerCase()] || []) : [];
      const roleKey = getHighestChannelRole(modes);
      const roleLabel = roleKey ? ROLE_CONFIGS[roleKey]?.label || "Member" : "Member";
      const memberObj = activeServer?.members?.find((m) => m.profile?.name?.toLowerCase() === n.toLowerCase());
      return { nick: n, roleKey, roleLabel, avatarUrl: memberObj?.profile?.imageUrl };
    });

    setNickQueryInfo({
      queryWord: rawWord,
      startIndex: wordStartIndex,
      endIndex: cursorPos,
      isStartOfMessage,
    });
    setNickSuggestions(suggestions);
    setSelectedNickIndex(0);
    setShowNickMenu(true);
  }, [form, getChannelNicknames, servers, query?.serverId, type, activeId, channelUserModesMap, onNickSelect]);

  useEffect(() => {
    if (!showNickMenu || !nickQueryInfo) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea ? (textarea.selectionStart ?? content.length) : content.length;

    if (cursorPos < nickQueryInfo.startIndex) {
      setShowNickMenu(false);
      setNickQueryInfo(null);
      return;
    }

    const currentWord = content.slice(nickQueryInfo.startIndex, cursorPos);

    if (!currentWord || /\s/.test(currentWord)) {
      setShowNickMenu(false);
      setNickQueryInfo(null);
      return;
    }

    if (currentWord === nickQueryInfo.queryWord) return;

    const allNicks = getChannelNicknames();
    const filtered = allNicks.filter((n) =>
      n.toLowerCase().startsWith(currentWord.toLowerCase())
    );

    if (filtered.length === 0) {
      setShowNickMenu(false);
      setNickQueryInfo(null);
      return;
    }

    const activeServer = query?.serverId ? servers.find((s) => s.id === query.serverId) : servers[0];
    const suggestions = filtered.map((n) => {
      const modes = (type === "channel" && activeId) ? (channelUserModesMap[activeId]?.[n.toLowerCase()] || []) : [];
      const roleKey = getHighestChannelRole(modes);
      const roleLabel = roleKey ? ROLE_CONFIGS[roleKey]?.label || "Member" : "Member";
      const memberObj = activeServer?.members?.find((m) => m.profile?.name?.toLowerCase() === n.toLowerCase());
      return { nick: n, roleKey, roleLabel, avatarUrl: memberObj?.profile?.imageUrl };
    });

    setNickSuggestions(suggestions);
    setNickQueryInfo((prev) =>
      prev
        ? {
            ...prev,
            queryWord: currentWord,
            endIndex: cursorPos,
          }
        : null
    );
    setSelectedNickIndex(0);
  }, [
    content,
    showNickMenu,
    nickQueryInfo,
    getChannelNicknames,
    servers,
    query?.serverId,
    type,
    activeId,
    channelUserModesMap,
  ]);

  useEffect(() => {
    if (showNickMenu && nickListRef.current) {
      const activeEl = nickListRef.current.children[selectedNickIndex] as HTMLElement | undefined;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedNickIndex, showNickMenu]);

  useEffect(() => {
    if (showCommands && commandListRef.current) {
      const activeEl = commandListRef.current.children[selectedCommandIndex] as HTMLElement | undefined;
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [selectedCommandIndex, showCommands]);
  const handleFormattingPreviewResizeStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = formattingPreviewHeight;

      const onMove = (moveEvent: MouseEvent) => {
        const nextHeight = Math.min(
          FORMATTING_PREVIEW_HEIGHT_MAX,
          Math.max(FORMATTING_PREVIEW_HEIGHT_MIN, startHeight - (moveEvent.clientY - startY))
        );
        setFormattingPreviewHeight(nextHeight);
      };

      const onUp = () => {
        document.body.style.removeProperty("user-select");
        document.body.style.removeProperty("cursor");
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.body.style.userSelect = "none";
      document.body.style.cursor = "ns-resize";
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [formattingPreviewHeight]
  );

  const applyMarkdownWrap = useCallback(
    (before: string, after: string) => {
      const textarea = textareaRef.current;
      if (!textarea || isInputDisabled) return;

      const currentValue = form.getValues("content") || "";
      const { newValue, newSelectionStart, newSelectionEnd } = toggleMarkdownWrap(
        textarea,
        before,
        after
      );

      if (wireBytesFor(newValue) > maxBytes) {
        onOpen("ircError", {
          title: "Message length limit exceeded",
          description: `Formatting would exceed the maximum allowed message limit of ${maxBytes} bytes.`,
        });
        return;
      }

      pushUndoState(currentValue);
      form.setValue("content", newValue, { shouldDirty: true });
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
        setSelectionRange({ start: newSelectionStart, end: newSelectionEnd });
        autoResize();
      }, 0);
    },
    [form, isInputDisabled, maxBytes, onOpen, wireBytesFor, autoResize, pushUndoState]
  );

  const applyMarkdownTransform = useCallback(
    (transform: (textarea: HTMLTextAreaElement) => {
      newValue: string;
      newSelectionStart: number;
      newSelectionEnd: number;
    }) => {
      const textarea = textareaRef.current;
      if (!textarea || isInputDisabled) return;

      const currentValue = form.getValues("content") || "";
      const { newValue, newSelectionStart, newSelectionEnd } = transform(textarea);

      if (wireBytesFor(newValue) > maxBytes) {
        onOpen("ircError", {
          title: "Message length limit exceeded",
          description: `Formatting would exceed the maximum allowed message limit of ${maxBytes} bytes.`,
        });
        return;
      }

      pushUndoState(currentValue);
      form.setValue("content", newValue, { shouldDirty: true });
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(newSelectionStart, newSelectionEnd);
        setSelectionRange({ start: newSelectionStart, end: newSelectionEnd });
        autoResize();
      }, 0);
    },
    [form, isInputDisabled, maxBytes, onOpen, wireBytesFor, autoResize, pushUndoState]
  );

  const handleUndo = useCallback(() => {
    const current = form.getValues("content") || "";
    const previous = undoStackRef.current.pop();
    if (previous === undefined) return;

    redoStackRef.current.push(current);
    isUndoRedoRef.current = true;
    form.setValue("content", previous, { shouldDirty: true });
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const pos = Math.min(previous.length, textarea.selectionStart);
      textarea.focus();
      textarea.setSelectionRange(pos, pos);
      setSelectionRange({ start: pos, end: pos });
      autoResize();
    }, 0);
  }, [form, autoResize]);

  const handleRedo = useCallback(() => {
    const current = form.getValues("content") || "";
    const next = redoStackRef.current.pop();
    if (next === undefined) return;

    undoStackRef.current.push(current);
    if (undoStackRef.current.length > INPUT_UNDO_LIMIT) {
      undoStackRef.current.shift();
    }

    isUndoRedoRef.current = true;
    form.setValue("content", next, { shouldDirty: true });
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      const pos = Math.min(next.length, textarea.selectionStart);
      textarea.focus();
      textarea.setSelectionRange(pos, pos);
      setSelectionRange({ start: pos, end: pos });
      autoResize();
    }, 0);
  }, [form, autoResize]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommands && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedCommandIndex((prev) => (prev + 1) % filteredCommands.length);
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedCommandIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
        return;
      } else if (e.key === "Tab") {
        e.preventDefault();
        onCommandSelect(filteredCommands[selectedCommandIndex].insert);
        return;
      } else if (e.key === "Enter") {
        const selected = filteredCommands[selectedCommandIndex];
        if (content.trim() !== selected.insert.trim()) {
          e.preventDefault();
          onCommandSelect(selected.insert);
          return;
        }
        setShowCommands(false);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowCommands(false);
        return;
      }
    }

    if (showNickMenu && nickSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedNickIndex((prev) => (prev + 1) % nickSuggestions.length);
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedNickIndex((prev) => (prev - 1 + nickSuggestions.length) % nickSuggestions.length);
        return;
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (nickSuggestions.length === 1) {
          const selected = nickSuggestions[0];
          if (selected) {
            onNickSelect(selected.nick);
          }
        } else {
          if (e.shiftKey) {
            setSelectedNickIndex((prev) => (prev - 1 + nickSuggestions.length) % nickSuggestions.length);
          } else {
            setSelectedNickIndex((prev) => (prev + 1) % nickSuggestions.length);
          }
        }
        return;
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = nickSuggestions[selectedNickIndex];
        if (selected) {
          onNickSelect(selected.nick);
        }
        return;
      } else if (e.key === "Escape") {
        e.preventDefault();
        setShowNickMenu(false);
        return;
      }
    }

    if (e.key === "Tab" && !showCommands) {
      e.preventDefault();
      openNickSuggestionsMenu();
      return;
    }

    if (e.key === "Escape" && pendingReply && activeId) {
      e.preventDefault();
      clearPendingReply(activeId);
      return;
    }

    if (!isInputDisabled && (e.ctrlKey || e.metaKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (key === "y" || (key === "z" && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (key === "e" && e.shiftKey) {
        e.preventDefault();
        applyMarkdownWrap("`", "`");
        return;
      }

      const format = MARKDOWN_FORMATS.find(
        (item) =>
          e.key.toLowerCase() === item.shortcut &&
          e.shiftKey === item.shift
      );
      if (format) {
        e.preventDefault();
        applyMarkdownWrap(format.before, format.after);
        return;
      }
    }

    if (e.key === "Enter" && !e.shiftKey) {
      const hasText = Boolean((form.getValues("content") || "").trim());
      const hasReadyImage = attachedImages.some((img) => !img.isUploading && img.url);
      if (!hasText && !hasReadyImage) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      form.handleSubmit(onSubmit)();
      return;
    }
  };

  useEffect(() => {
    autoResize();
    const timer = setTimeout(() => {
      autoResize();
    }, 0);
    return () => clearTimeout(timer);
  }, [content, autoResize]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setShowNickMenu(false);
    setNickQueryInfo(null);

    const textContent = values.content?.trim() || "";
    const readyImages = attachedImages.filter((img) => !img.isUploading && img.url);
    const replyTarget = activeId ? useReplyStore.getState().getPending(activeId) : undefined;

    if (attachedImages.some((img) => img.isUploading)) return;
    if (!textContent && readyImages.length === 0) return;

    const linesToSend: string[] = [];
    if (textContent) {
      linesToSend.push(textContent);
    }
    readyImages.forEach((img) => {
      if (img.url) linesToSend.push(img.url);
    });

    try {
      const activeServer = query?.serverId ? servers.find((s) => s.id === query.serverId) : servers[0];
      if (!activeServer) return;

      const isConnected = !!ircConnectedServers[activeServer.id];
      if (!isConnected) {
        onOpen("ircError");
        return;
      }

      const senderMember: Member = currentMember
        ? {
            ...currentMember,
            profile: {
              ...currentMember.profile,
              name: primaryNick || currentMember.profile.name,
            },
          }
        : {
            id: `self-${activeServer.id}`,
            profileId: currentProfile.id,
            profile: {
              ...currentProfile,
              name: primaryNick || currentProfile.name,
            },
            serverId: activeServer.id,
          };

      if (textContent.startsWith("/")) {
        let inputUpdated = false;
        const ctx = createCommandContext(() => {
          inputUpdated = true;
        });

        if (ctx) {
          const isHandled = await commandRegistry.execute(textContent, ctx);

          if (isHandled) {
            for (const img of readyImages) {
              if (img.url) {
                if (type === "channel" && query?.channelId) {
                  await invoke("send_message", {
                    serverId: activeServer.id,
                    channel: name.startsWith("#") ? name : `#${name}`,
                    message: img.url,
                    replyToMsgid: null,
                  replyNick: null,
                  replyPreview: null,
                  replyParentOffset: null,
                  }).catch((e) => console.error(e));
                  const created = addMessage(query.channelId, senderMember, img.url);
                  markTailSeen(created.id);
                  clearUnreadMarker();
                  setTailPinned(true);
                } else if (type === "conversation" && query?.conversationId) {
                  await invoke("send_message", {
                    serverId: activeServer.id,
                    channel: name,
                    message: img.url,
                    replyToMsgid: null,
                  replyNick: null,
                  replyPreview: null,
                  replyParentOffset: null,
                  }).catch((e) => console.error(e));
                  const created = addDirectMessage(query.conversationId, senderMember, img.url);
                  markTailSeen(created.id);
                  clearUnreadMarker();
                  setTailPinned(true);
                  if (query.targetMemberId) {
                    useMockStore.getState().addToHistoricalConversations(activeServer.id, query.targetMemberId);
                  }
                }
              }
            }
            if (!inputUpdated) {
              if (activeId) {
                clearDraft(activeId);
                clearPendingReply(activeId);
              }
              form.reset({ content: "" });
              clearAllAttachments();
              focusInput();
            }
            return;
          }

        }

        const expanded = expandCustomCommand(textContent, activeServer.customCommands);
        if (expanded !== null) {
          linesToSend.length = 0;
          linesToSend.push(expanded);
          readyImages.forEach((img) => {
            if (img.url) linesToSend.push(img.url);
          });
        }
      }

      if (activeId) {
        clearDraft(activeId);
        clearPendingReply(activeId);
      }
      form.reset({ content: "" });
      clearAllAttachments();
      focusInput();

      for (const line of linesToSend) {
        const targetName = type === "channel" ? (name.startsWith("#") ? name : `#${name}`) : name;

        const isReplyLineLocal =
          Boolean(replyTarget) &&
          Boolean(textContent) &&
          line === linesToSend[0] &&
          !textContent.startsWith("/");
        const replyMeta = isReplyLineLocal && replyTarget
          ? {
              replyToMsgid: replyTarget.msgid,
              replyTo: {
                messageId: replyTarget.messageId,
                nick: replyTarget.nick,
                preview: replyTarget.preview,
                msgid: replyTarget.msgid,
              },
            }
          : undefined;

        if (type === "channel" && query?.channelId) {
          const created = addMessage(query.channelId, senderMember, line, null, false, replyMeta);
          markTailSeen(created.id);
          clearUnreadMarker();
          setTailPinned(true);
          if (isReplyLineLocal && replyTarget) {
            rememberSentReply(created.id, replyTarget);
          }
        } else if (type === "conversation" && query?.conversationId) {
          const created = addDirectMessage(query.conversationId, senderMember, line, null, false, replyMeta);
          markTailSeen(created.id);
          clearUnreadMarker();
          setTailPinned(true);
          if (isReplyLineLocal && replyTarget) {
            rememberSentReply(created.id, replyTarget);
          }
          if (query.targetMemberId) {
            useMockStore.getState().addToHistoricalConversations(activeServer.id, query.targetMemberId);
          }
        }

        // Format message for IRC: replace newlines with NEL character (ASCII C1 Hex 85 / \u0085)
        const ircMessage = line.replace(/\r?\n/g, "\u0085");

        try {
          await invoke("send_message", {
            serverId: activeServer.id,
            channel: targetName,
            message: ircMessage,
            replyToMsgid: isReplyLineLocal ? replyTarget?.msgid ?? null : null,
          replyNick: isReplyLineLocal ? replyTarget?.nick ?? null : null,
          replyPreview: isReplyLineLocal ? replyTarget?.preview ?? null : null,
          replyParentOffset:
            isReplyLineLocal && replyTarget?.parentOffset != null
              ? replyTarget.parentOffset
              : null,
          });
        } catch (err: any) {
          console.error("Failed to send message via Tauri IRC:", err);
          if (type === "channel" && query?.channelId) {
            useMockStore.getState().removeLastMessageFromChannel(query.channelId, senderMember.id);
          } else if (type === "conversation" && query?.conversationId) {
            useMockStore.getState().removeLastDirectMessageFromMember(query.conversationId, senderMember.id);
          }
          await invoke("delete_last_log_entry", {
            serverId: activeServer.id,
            target: targetName,
            sender: senderMember.profile.name,
          }).catch(() => {});
          form.setValue("content", textContent);
          return;
        }
      }

      // Safety net: make sure the composer regains keyboard focus once the
      // async send finishes (e.g. if anything grabbed focus mid-send).
      focusInput();
    } catch (error) {
      console.error(error);
    }
  };

  const isServerConnecting = activeServer ? !!ircConnectingServers[activeServer.id] : false;
  const isConnecting = localConnecting || isServerConnecting;

  const handleReconnect = async () => {
    if (!activeServer) return;
    setLocalConnecting(true);
    try {
      await connectServer(activeServer.id);
    } finally {
      setLocalConnecting(false);
    }
  };

  if (!isIrcConnected && activeServer) {
    return (
      <div className="p-4 pb-6">
        <div className="flex items-center justify-between gap-x-3 p-3.5 bg-zinc-200/90 dark:bg-[#2b2d31] rounded-lg border border-amber-500/30 text-zinc-600 dark:text-zinc-300 shadow-sm animate-in fade-in duration-200">
          <div className="flex items-center gap-x-3 min-w-0">
            <div className={cn(
              "h-3 w-3 rounded-full shrink-0 ring-2",
              isConnecting ? "bg-indigo-500 ring-indigo-500/20 animate-ping" : "bg-amber-500 ring-amber-500/20 animate-pulse"
            )} />
            <div className="flex flex-col min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-zinc-800 dark:text-zinc-100 truncate">
                {isConnecting ? `Connecting to ${activeServer.name}...` : `Disconnected from ${activeServer.name}`}
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                {isConnecting ? "Establishing IRC connection..." : "You cannot send messages while disconnected."}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReconnect}
            disabled={isConnecting}
            className="shrink-0 flex items-center gap-x-2 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold shadow transition active:scale-95 disabled:opacity-75 disabled:cursor-not-allowed"
          >
            {isConnecting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Radio className="w-3.5 h-3.5" />
            )}
            <span>{isConnecting ? "Connecting..." : "Connect to server"}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="off">
        <input
          ref={fileInputRef}
          type="file"
          accept="*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <FormField
          control={form.control}
          name="content"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <div className="relative p-4 pb-6">
                  {pendingReply && (
                    <div className="mb-2 flex items-center gap-x-3 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2">
                      <div className="w-0.5 self-stretch rounded-full bg-indigo-500 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-indigo-500 dark:text-indigo-400">
                          Replying to {pendingReply.nick}
                        </p>
                        <p className="text-xs italic text-zinc-500 dark:text-zinc-400 truncate">
                          {pendingReply.preview}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => activeId && clearPendingReply(activeId)}
                        className="h-6 w-6 rounded-md text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/70 flex items-center justify-center transition"
                        title="Cancel reply"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {attachedImages.length > 0 && (
                    <div className="flex items-center gap-x-3 mb-2 overflow-x-auto pb-2 pt-1 px-1">
                      {attachedImages.map((img) => {
                        const isMedia = isMediaUrl(img.name);
                        return (
                          <div
                            key={img.id}
                            className="p-2 bg-zinc-200/90 dark:bg-zinc-800/90 rounded-xl flex items-center gap-x-3 relative group border border-zinc-300/80 dark:border-zinc-700/80 shadow-md transition-all"
                          >
                            <ImageContextMenu url={img.url || img.previewUrl} filename={img.name}>
                              <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-black/10 shrink-0 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center">
                                {isMedia ? (
                                  <img
                                    src={img.previewUrl}
                                    alt={img.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <FileIcon className="w-7 h-7 text-indigo-500 dark:text-indigo-400" />
                                )}
                                {img.isUploading && (
                                  <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px] flex items-center justify-center">
                                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                                  </div>
                                )}
                              </div>
                            </ImageContextMenu>
                            <div className="flex flex-col pr-5 max-w-[150px]">
                              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                                {img.name}
                              </span>
                              <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                                {img.isUploading ? "Uploading..." : "Ready"}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeAttachment(img.id)}
                              className="absolute -top-2 -right-2 h-6 w-6 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center transition shadow-lg z-10"
                              title="Remove attachment"
                            >
                              <X className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {showCommands && filteredCommands.length > 0 && (
                    <div className="absolute bottom-full left-4 mb-2 w-80 bg-white dark:bg-[#2b2d31] border border-zinc-200 dark:border-zinc-800 rounded-md shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <div className="px-3 py-2 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider bg-zinc-50 dark:bg-[#232428] border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                        <span className="truncate">Commands matching {content?.startsWith("/") ? content.split(/\s/)[0] : "/"}</span>
                        <span className="text-[10px] font-normal text-zinc-400 shrink-0 ml-1.5">{filteredCommands.length}</span>
                      </div>
                      <div ref={commandListRef} className="max-h-60 overflow-y-auto p-1 discord-scrollbar-ghost">
                        {filteredCommands.map((cmd, idx) => (
                          <div
                            key={`${cmd.insert}-${idx}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              onCommandSelect(cmd.insert);
                            }}
                            className={`flex items-center gap-x-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                              idx === selectedCommandIndex
                                ? "bg-zinc-100 dark:bg-zinc-700/50"
                                : "hover:bg-zinc-100 dark:hover:bg-zinc-700/30"
                            }`}
                          >
                            <div className="bg-indigo-100 dark:bg-indigo-500/20 p-2 rounded-md shrink-0">
                              <Command className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                                {cmd.label}
                              </span>
                              <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                {cmd.description}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {showNickMenu && nickSuggestions.length > 0 && (
                    <div className="absolute bottom-full left-4 mb-2 w-80 bg-white dark:bg-[#2b2d31] border border-zinc-200 dark:border-zinc-800 rounded-md shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                      <div className="px-3 py-2 text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider bg-zinc-50 dark:bg-[#232428] border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                        <div className="flex items-center gap-x-1.5 min-w-0">
                          <Users className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate">
                            Members {nickQueryInfo?.queryWord ? `matching "${nickQueryInfo.queryWord}"` : `in channel`}
                          </span>
                        </div>
                        <span className="text-[10px] font-normal text-zinc-400">
                          {nickSuggestions.length}
                        </span>
                      </div>
                      <div ref={nickListRef} className="max-h-60 overflow-y-auto p-1">
                        {nickSuggestions.map((item, idx) => (
                          <div
                            key={`${item.nick}-${idx}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              onNickSelect(item.nick);
                            }}
                            className={`flex items-center gap-x-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                              idx === selectedNickIndex
                                ? "bg-zinc-100 dark:bg-zinc-700/50"
                                : "hover:bg-zinc-100 dark:hover:bg-zinc-700/30"
                            }`}
                          >
                            <UserAvatar
                              src={item.avatarUrl}
                              name={item.nick}
                              className="h-8 w-8 md:h-8 md:w-8"
                            />
                            <div className="flex items-center gap-x-1.5 min-w-0 flex-1">
                              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                                {item.nick}
                              </span>
                              {item.roleKey && (
                                <UserRoleIcon role={item.roleKey} className="w-3.5 h-3.5" showTooltip={false} />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div
                    className={cn(
                      "relative flex flex-col rounded-lg overflow-hidden",
                      "bg-zinc-200/90 dark:bg-zinc-700/75"
                    )}
                  >
                    {showFormattingPreview && (
                      <div className="flex flex-col border-b border-zinc-300/50 dark:border-zinc-600/50">
                        <div
                          role="separator"
                          aria-orientation="horizontal"
                          aria-label="Resize formatting preview"
                          title="Drag to resize preview"
                          onMouseDown={handleFormattingPreviewResizeStart}
                          onDoubleClick={() => setFormattingPreviewHeight(FORMATTING_PREVIEW_HEIGHT_DEFAULT)}
                          className="flex items-center justify-between px-3 py-1 cursor-ns-resize hover:bg-zinc-300/40 dark:hover:bg-zinc-600/40 transition-colors group shrink-0 border-b border-zinc-300/40 dark:border-zinc-600/40 select-none"
                        >
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                            Preview
                          </span>
                          <GripHorizontal className="w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-zinc-600 dark:group-hover:text-zinc-300" />
                        </div>
                        <div
                          className="px-3 py-2 overflow-y-auto"
                          style={{ height: formattingPreviewHeight }}
                        >
                          <MarkdownRenderer
                            content={content}
                            compact
                            className="text-sm text-zinc-700 dark:text-zinc-200"
                          />
                        </div>
                      </div>
                    )}

                    <div className="relative">
                    <Textarea
                      disabled={isInputDisabled}
                      autoFocus
                      className="min-h-[44px] max-h-[120px] w-full bg-transparent border-none focus-visible:ring-0 focus-visible:ring-offset-0 text-zinc-600 dark:text-zinc-200 placeholder:text-zinc-500 dark:placeholder:text-zinc-400 py-3 resize-none overflow-y-auto disabled:opacity-60 disabled:cursor-not-allowed"
                      style={{ paddingRight: enableMarkdown ? "20rem" : "9rem" }}
                      placeholder={
                        !isIrcConnected
                          ? "Disconnected from IRC server"
                          : isMuted
                          ? "You do not have permission to send messages in this moderated channel"
                          : isUploading
                          ? "Uploading files..."
                          : pendingReply
                          ? `Reply to ${pendingReply.nick}`
                          : `Message ${type === "conversation" ? name : "#" + name}`
                      }
                      rows={1}
                      {...field}
                      onChange={(e) => {
                        const newVal = e.target.value;
                        const bytes = wireBytesFor(newVal);
                        if (bytes > maxBytes) return;

                        const currentVal = field.value || "";
                        if (!isUndoRedoRef.current && newVal !== currentVal) {
                          pushUndoState(currentVal);
                        }
                        isUndoRedoRef.current = false;
                        field.onChange(e);
                      }}
                      onPaste={handlePaste}
                      ref={(e) => {
                        field.ref(e);
                        // @ts-ignore
                        textareaRef.current = e;
                      }}
                      onFocus={() => setIsFocused(true)}
                      onBlur={() => setIsFocused(false)}
                      onSelect={updateSelection}
                      onClick={updateSelection}
                      onKeyUp={updateSelection}
                      onKeyDown={handleInputKeyDown}
                      onInput={autoResize}
                    />

                    <div className="absolute right-3 bottom-2 z-10 flex items-center gap-x-1">
                      {enableMarkdown &&
                        MARKDOWN_FORMATS.map(({ id, icon: Icon, before, after, label }) => (
                        <ActionTooltip key={id} label={label} side="top">
                          <button
                            type="button"
                            disabled={isInputDisabled}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applyMarkdownWrap(before, after)}
                            className={cn(
                              "h-7 w-7 transition flex items-center justify-center rounded-md disabled:opacity-50 disabled:cursor-not-allowed",
                              activeFormatIds.has(id)
                                ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/30"
                                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-300/50 dark:hover:bg-zinc-600/50"
                            )}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </button>
                        </ActionTooltip>
                      ))}

                      {enableMarkdown && (
                        <DropdownMenu>
                          <ActionTooltip label="More formatting" side="top">
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                disabled={isInputDisabled}
                                onMouseDown={(e) => e.preventDefault()}
                                className="h-7 w-7 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition flex items-center justify-center rounded-md hover:bg-zinc-300/50 dark:hover:bg-zinc-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                          </ActionTooltip>
                          <DropdownMenuContent
                            side="top"
                            align="end"
                            className="min-w-[10rem] bg-white dark:bg-[#2b2d31] border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200"
                          >
                            <DropdownMenuItem
                              className="gap-x-2 cursor-pointer focus:bg-zinc-100 dark:focus:bg-zinc-700/60"
                              onSelect={() => applyMarkdownTransform((textarea) => wrapCodeBlock(textarea))}
                            >
                              <Code className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                              <span>Code block</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                              className="gap-x-2 cursor-pointer focus:bg-zinc-100 dark:focus:bg-zinc-700/60"
                              onSelect={() => applyMarkdownTransform((textarea) => toggleMarkdownWrap(textarea, "`", "`"))}
                            >
                              <SquareCode className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                              <span>Inline code</span>
                            </DropdownMenuItem>

                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger className="gap-x-2 cursor-pointer focus:bg-zinc-100 dark:focus:bg-zinc-700/60">
                                <Heading className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                                <span>Heading</span>
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="bg-white dark:bg-[#2b2d31] border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200">
                                {HEADING_LEVELS.map(({ level, label, preview }) => (
                                  <DropdownMenuItem
                                    key={level}
                                    className="gap-x-2 cursor-pointer focus:bg-zinc-100 dark:focus:bg-zinc-700/60"
                                    onSelect={() =>
                                      applyMarkdownTransform((textarea) => toggleHeadingPrefix(textarea, level))
                                    }
                                  >
                                    <span className="w-8 font-mono text-xs text-zinc-500 dark:text-zinc-400">{preview}</span>
                                    <span>{label}</span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>

                            {EXTRA_MARKDOWN_ACTIONS.slice(1).map(({ id, label, icon: Icon, apply }) => (
                              <DropdownMenuItem
                                key={id}
                                className="gap-x-2 cursor-pointer focus:bg-zinc-100 dark:focus:bg-zinc-700/60"
                                onSelect={() => applyMarkdownTransform(apply)}
                              >
                                <Icon className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                                <span>{label}</span>
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}

                      {enableMarkdown && (
                        <div className="w-px h-4 bg-zinc-300/80 dark:bg-zinc-600/80 mx-0.5" />
                      )}

                      <div
                        className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded transition-colors select-none ${
                          currentBytes >= maxBytes
                            ? "bg-rose-500 text-white font-bold shadow-sm"
                            : "bg-zinc-300/60 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400"
                        }`}
                        title={`IRC message byte limit: ${currentBytes} / ${maxBytes} bytes`}
                      >
                        {currentBytes}/{maxBytes}
                      </div>

                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => fileInputRef.current?.click()}
                        className="h-7 w-7 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition flex items-center justify-center rounded-md hover:bg-zinc-300/50 dark:hover:bg-zinc-600/50 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Attach files (System dialog)"
                      >
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                        ) : (
                          <Paperclip className="w-4 h-4" />
                        )}
                      </button>

                      <EmojiPicker
                        disabled={isLoading}
                        onChange={(emoji: string) => {
                          const currentVal = field.value || "";
                          const newText = `${currentVal ? currentVal + " " : ""}${emoji}`;
                          const bytes = wireBytesFor(newText);
                          if (bytes <= maxBytes) {
                            field.onChange(newText);
                            form.setFocus("content");
                          } else {
                            onOpen("ircError", {
                              title: "Message length limit exceeded",
                              description: `Adding this emoji would exceed the maximum allowed message limit of ${maxBytes} bytes.`,
                            });
                          }
                        }}
                      />
                    </div>
                    </div>
                  </div>

                  {uploadError && (
                    <div className="mt-1 text-[11px] font-semibold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 truncate max-w-[80%]">
                      ⚠️ {uploadError}
                    </div>
                  )}
                </div>
              </FormControl>
            </FormItem>
          )}
        />
      </form>
    </Form>
  );
};
