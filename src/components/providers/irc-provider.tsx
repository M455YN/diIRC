import i18n from "@/lib/i18n";
import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useMockStore, getServerSelfMember, getServerActiveNick, isSystemMessage, buildConnectParams, createSystemMember } from "@/lib/mock-store";
import { useModalStore } from "@/hooks/use-modal-store";
import { useDraftStore } from "@/hooks/use-draft-store";
import { stripCompatReply, useReplyStore } from "@/hooks/use-reply-store";
import { useReactionStore } from "@/hooks/use-reaction-store";
import { reactionChatKey } from "@/lib/reactions";
import { handleAvatarEvent, noteSpeaker } from "@/lib/avatars";
import { announceHello, handleHelloEvent } from "@/lib/luna-peers";
import { logLuna } from "@/hooks/use-luna-log-store";
import { openIrcUrl } from "@/lib/irc-url";
import { typingChatKey, useTypingStore } from "@/hooks/use-typing-store";
import { useMessageCapsStore } from "@/hooks/use-message-caps";
import { Server, ChannelType } from "@/types";
import { extractFlag } from "@/lib/flag-tips";
import {
  resolveEffectiveNotificationSettings,
  triggerIncomingNotification,
  clearNotificationGroup,
  checkIsMention,
} from "@/lib/notification-service";
import { IrcMultilineAccumulator } from "@/lib/irc-multiline-accumulator";

interface IrcMessagePayload {
  serverId?: string;
  server_id?: string;
  sender: string;
  content: string;
  channel: string;
  isSystem?: boolean;
  is_system?: boolean;
  msgid?: string | null;
  reply_to_msgid?: string | null;
  replyToMsgid?: string | null;
  reply_nick?: string | null;
  replyNick?: string | null;
  reply_preview?: string | null;
  replyPreview?: string | null;
  timestamp?: string;
  log_id?: string | null;
}

interface IrcUserEventPayload {
  server_id: string;
  channel: string;
  users: string[];
  event_type: string;
}

interface IrcUserHostEventPayload {
  server_id: string;
  nick: string;
  host: string;
  realname?: string;
}

export const IrcProvider = ({ children }: { children: React.ReactNode }) => {
  const addMessage = useMockStore((state) => state.addMessage);
  const currentProfile = useMockStore((state) => state.currentProfile);
  const servers = useMockStore((state) => state.servers);
  const addServerMember = useMockStore((state) => state.addServerMember);
  const removeServerMember = useMockStore((state) => state.removeServerMember);
  const updateChannelMembers = useMockStore((state) => state.updateChannelMembers);
  const setIrcConnected = useMockStore((state) => state.setIrcConnected);
  const setIrcConnecting = useMockStore((state) => state.setIrcConnecting);
  const activeChatKey = useMockStore((state) => state.activeChatKey);
  const navigate = useNavigate();
  const connectedConfigsRef = useRef<Map<string, string>>(new Map());
  const connectingRef = useRef<Set<string>>(new Set());
  const attemptsRef = useRef<Map<string, number>>(new Map());
  const nextReconnectTimeRef = useRef<Map<string, number>>(new Map());
  // Resolved once every backend event listener is registered. Connecting earlier could lose the first
  // events (JOIN / NAMES / WHO of the autojoined channels), which left the member list showing only us.
  const listenersReadyRef = useRef<{ promise: Promise<void>; resolve: () => void } | null>(null);
  if (!listenersReadyRef.current) {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => { resolve = done; });
    listenersReadyRef.current = { promise, resolve };
  }

  // Clear notifications & unreads for active chat when switched or focused
  useEffect(() => {
    if (activeChatKey) {
      useMockStore.getState().clearUnread(activeChatKey);
      const parts = activeChatKey.split(":");
      if (parts.length >= 2) {
        const type = parts[0];
        const chatId = parts[1];
        const store = useMockStore.getState();
        for (const server of store.servers) {
          if (type === "channel" && server.channels.some((c) => c.id === chatId)) {
            clearNotificationGroup(`chan:${server.id}:${chatId}`);
            break;
          }
          if (type === "conversation") {
            clearNotificationGroup(`dm:${server.id}:${chatId}`);
          }
        }
      }
    }
  }, [activeChatKey]);

  useEffect(() => {
    const handleFocus = () => {
      const store = useMockStore.getState();
      if (store.activeChatKey) {
        store.clearUnread(store.activeChatKey);
      }
    };

    window.addEventListener("focus", handleFocus);

    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/window")
      .then(({ getCurrentWindow }) => {
        const appWindow = getCurrentWindow();
        appWindow.listen("tauri://focus", handleFocus).then((fn) => {
          unlisten = fn;
        });
      })
      .catch(() => {});

    return () => {
      window.removeEventListener("focus", handleFocus);
      if (unlisten) unlisten();
    };
  }, []);

  // Listen for notification click events from OS (Linux D-Bus / Web)
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/event")
      .then(({ listen }) => {
        listen<string>("notification_clicked", (event) => {
          const tag = event.payload;
          if (!tag) return;

          const parts = tag.split(":");
          if (parts.length >= 3) {
            const kind = parts[0];
            const serverId = parts[1];
            const targetId = parts[2];

            const store = useMockStore.getState();
            const server = store.servers.find((s) => s.id === serverId);
            if (!server) return;

            if (kind === "chan") {
              const channel = server.channels.find(
                (c) => c.id === targetId || c.name.toLowerCase() === targetId.toLowerCase()
              );
              if (channel) {
                navigate(`/servers/${serverId}/channels/${channel.id}`);
              }
            } else if (kind === "dm") {
              const member = server.members.find((m) => m.id === targetId);
              if (member) {
                store.openConversation(serverId, member.id);
                navigate(`/servers/${serverId}/conversations/${member.id}`);
              }
            }
            clearNotificationGroup(tag);
          }
        })
          .then((un) => {
            unlisten = un;
          })
          .catch(console.error);
      })
      .catch(console.error);

    return () => {
      unlisten?.();
    };
  }, [navigate]);

  const attemptConnect = useCallback(async (server: Server) => {
    if (connectingRef.current.has(server.id)) return;
    connectingRef.current.add(server.id);
    setIrcConnecting(server.id, true);

    await listenersReadyRef.current!.promise;
    const params = buildConnectParams(server, currentProfile.name);

    try {
      await invoke("connect_irc", { params });
      console.log(`Initiated IRC connection for server ${server.name} (${server.id}) with nicks:`, params.nicknames);
    } catch (error) {
      console.error(`Failed to connect IRC for server ${server.name}:`, error);
      const errMsg = error instanceof Error ? error.message : String(error);
      setIrcConnecting(server.id, false);
      setIrcConnected(server.id, false, errMsg);
    } finally {
      connectingRef.current.delete(server.id);
    }
  }, [currentProfile.name, setIrcConnected, setIrcConnecting]);

  // Connect / Reconnect servers to IRC when server configs or list change
  useEffect(() => {
    const currentServerIds = new Set(servers.map((s) => s.id));

    // Cleanup disconnected servers
    connectedConfigsRef.current.forEach(async (_, serverId) => {
      if (!currentServerIds.has(serverId)) {
        connectedConfigsRef.current.delete(serverId);
        setIrcConnected(serverId, false);
        try {
          await invoke("disconnect_irc", { serverId });
        } catch (e) {
          console.error(`Failed to disconnect removed server ${serverId}:`, e);
        }
      }
    });

    servers.forEach(async (server) => {
      // Respect autoConnect setting and manual disconnect flag
      if (server.autoConnect === false) return;
      if (useMockStore.getState().manuallyDisconnectedServers[server.id]) return;

      const nicks = server.nicknames && server.nicknames.length > 0 
        ? server.nicknames 
        : [server.nicknames?.[0] || currentProfile.name.replace(/\s+/g, "") || "ReactUser"];

      const configHash = JSON.stringify({
        host: server.host || "127.0.0.1",
        port: server.port || 6667,
        nicks,
        username: server.username || "",
        realname: server.realname || "",
        password: server.password || "",
        useTls: server.useTls || false,
      });

      const prevHash = connectedConfigsRef.current.get(server.id);

      // If configuration hasn't changed, skip
      if (prevHash === configHash) return;

      // Update stored hash
      connectedConfigsRef.current.set(server.id, configHash);

      if (prevHash) {
        console.log(`Config changed for IRC server ${server.name} (${server.id}), reconnecting...`);
        try {
          await invoke("disconnect_irc", { serverId: server.id });
        } catch (e) {
          console.error(`Failed to disconnect before reconnecting:`, e);
        }
        await new Promise((res) => setTimeout(res, 400));
      }

      await attemptConnect(server);
    });
  }, [servers, attemptConnect, setIrcConnected]);

  // Track which servers have been synced
  const syncedServersRef = useRef<Set<string>>(new Set());

  // Sync active Conversations with non-empty log files on disk
  useEffect(() => {
    servers.forEach(async (server) => {
      if (syncedServersRef.current.has(server.id)) return;
      syncedServersRef.current.add(server.id);
      
      try {
        const loggedNicks = await invoke<string[]>("list_logged_conversations", {
          serverId: server.id,
        });
        useMockStore.getState().syncActiveConversationsWithDisk(server.id, loggedNicks);
      } catch (err) {
        console.error(`Failed to sync conversations with disk for ${server.name}:`, err);
        // If it fails, allow it to retry later by removing from the set
        syncedServersRef.current.delete(server.id);
      }
    });
  }, [servers]);

  // Auto-reconnect loop with exponential backoff & error throttling for disconnected servers
  useEffect(() => {
    const interval = setInterval(() => {
      const { ircConnectedServers, ircConnectionErrors, manuallyDisconnectedServers, servers: currentServers } = useMockStore.getState();
      const now = Date.now();

      currentServers.forEach((server) => {
        // Skip if server auto-connect or auto-reconnect is disabled, or manually disconnected
        if (server.autoConnect === false) return;
        if (server.autoReconnect === false) return;
        if (manuallyDisconnectedServers[server.id]) return;

        // Skip if already connected or currently connecting
        if (ircConnectedServers[server.id] || connectingRef.current.has(server.id)) {
          attemptsRef.current.delete(server.id);
          nextReconnectTimeRef.current.delete(server.id);
          return;
        }

        // Check if server is blocked by rate-limiting
        const activeErr = ircConnectionErrors[server.id];
        if (activeErr && (activeErr.toLowerCase().includes("too many times") || activeErr.toLowerCase().includes("rate limit"))) {
          return;
        }

        // Backoff cooldown check
        const nextTime = nextReconnectTimeRef.current.get(server.id) || 0;
        if (now < nextTime) return;

        const currentAttempts = attemptsRef.current.get(server.id) || 0;
        // Exponential backoff: 15s, 30s, 60s, 120s, max 300s (5 min)
        const backoffMs = Math.min(15000 * Math.pow(2, currentAttempts), 300000);

        attemptsRef.current.set(server.id, currentAttempts + 1);
        nextReconnectTimeRef.current.set(server.id, now + backoffMs);

        console.log(`Auto-reconnecting to IRC server ${server.name} (attempt ${currentAttempts + 1}, backoff ${backoffMs / 1000}s)...`);
        attemptConnect(server);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [attemptConnect]);

  // Android: hold a foreground service while any server is connected, so the OS does not drop the sockets in background.
  useEffect(() => {
    let keepAlive = false;
    return useMockStore.subscribe((state) => {
      const anyConnected = Object.values(state.ircConnectedServers).some(Boolean);
      if (anyConnected === keepAlive) return;
      keepAlive = anyConnected;
      invoke("plugin:keep-alive|set_keep_alive", { payload: { enabled: anyConnected } }).catch((e) =>
        console.error("Failed to toggle keep-alive service:", e)
      );
    });
  }, []);

  // irc:// and ircs:// links opened from outside the app (browser, another program), also the one that launched it.
  useEffect(() => {
    if (document.documentElement.classList.contains("mobile-shell")) return; // the plugin is desktop-only
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const { getCurrent, onOpenUrl } = await import("@tauri-apps/plugin-deep-link");
        const open = (urls: string[] | null) => urls?.forEach((url) => void openIrcUrl(url, navigate));
        open(await getCurrent());
        const stop = await onOpenUrl(open);
        if (cancelled) stop();
        else unlisten = stop;
      } catch (error) {
        console.warn("Deep links are not available:", error);
      }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [navigate]);

  // The backend needs the QUIT message at disconnect time.
  useEffect(() => {
    const sync = (message: string) => invoke("set_quit_message", { message }).catch(() => undefined);
    let current = useMockStore.getState().quitMessage ?? "";
    sync(current);
    return useMockStore.subscribe((state) => {
      const next = state.quitMessage ?? "";
      if (next === current) return;
      current = next;
      sync(next);
    });
  }, []);

  // The backend drops messages from ignored users, so it needs the list at start and on every change.
  useEffect(() => {
    const sync = (masks: string[]) =>
      invoke("set_ignore_list", { patterns: masks }).catch((e) =>
        console.error("Failed to sync the ignore list:", e)
      );
    let current = useMockStore.getState().ignoredUsers ?? [];
    sync(current);
    return useMockStore.subscribe((state) => {
      const next = state.ignoredUsers ?? [];
      if (next === current) return;
      current = next;
      sync(next);
    });
  }, []);

  const multilineAccumulatorRef = useRef<IrcMultilineAccumulator | null>(null);

  const applyIncomingIrcMeta = (
    messageId: string,
    sender: string,
    content: string,
    msgid?: string | null,
    replyToMsgid?: string | null,
    replyFallback?: { nick: string; preview: string }
  ) => {
    const replyStore = useReplyStore.getState();
    if (msgid) {
      replyStore.indexMsgid(msgid, {
        messageId,
        nick: sender,
        preview: content,
      });
    }
    if (replyToMsgid) {
      const parent = replyStore.findByMsgid(replyToMsgid);
      if (parent) {
        replyStore.rememberSent(messageId, {
          messageId: parent.messageId,
          nick: parent.nick,
          preview: parent.preview,
          msgid: replyToMsgid,
        });
      } else if (replyFallback) {
        replyStore.rememberSent(messageId, {
          messageId: "",
          nick: replyFallback.nick,
          preview: replyFallback.preview,
          msgid: replyToMsgid,
        });
      }
    }
  };

  const processIncomingPayload = useCallback(async (payload: IrcMessagePayload) => {
    const { sender, channel } = payload;
    const rawContent = payload.content;
    const incoming = rawContent ? rawContent.replace(/\u0085/g, "\n") : "";
    const stripped = stripCompatReply(incoming);
    let content = stripped.body;
    const serverId = payload.serverId || payload.server_id;
    const isSystem = payload.isSystem ?? payload.is_system;
    const msgid = payload.msgid || null;
    const replyToMsgid = payload.reply_to_msgid || payload.replyToMsgid || null;
    const quoteNick = payload.reply_nick || payload.replyNick || stripped.nick;
    const quotePreview = payload.reply_preview || payload.replyPreview || stripped.preview;
    let parent = replyToMsgid
      ? useReplyStore.getState().findByMsgid(replyToMsgid)
      : undefined;

    // Fallback: If not indexed in replyStore, search currently loaded channel/DM messages
    if (replyToMsgid && !parent) {
      const store = useMockStore.getState();
      for (const msgs of Object.values(store.messages)) {
        const found = msgs.find((m) => m.ircMsgid === replyToMsgid);
        if (found) {
          parent = {
            messageId: found.id,
            nick: found.member.profile.name,
            preview: found.content,
          };
          useReplyStore.getState().indexMsgid(replyToMsgid, parent);
          break;
        }
      }
      if (!parent) {
        for (const msgs of Object.values(store.directMessages)) {
          const found = msgs.find((m) => m.ircMsgid === replyToMsgid);
          if (found) {
            parent = {
              messageId: found.id,
              nick: found.member.profile.name,
              preview: found.content,
            };
            useReplyStore.getState().indexMsgid(replyToMsgid, parent);
            break;
          }
        }
      }
    }

    // Last resort: the parent may be older than the in-memory window, so ask the on-disk log.
    if (replyToMsgid && !parent && !quoteNick && serverId) {
      const logTarget =
        channel.startsWith("#") || channel.startsWith("&") ? channel : sender;
      try {
        const entry = await invoke<{ sender: string; content: string } | null>(
          "find_log_message_by_msgid",
          { serverId, channel: logTarget, msgid: replyToMsgid }
        );
        if (entry) {
          parent = {
            messageId: "",
            nick: entry.sender,
            preview: entry.content.replace(/\u0085/g, "\n"),
          };
          useReplyStore.getState().indexMsgid(replyToMsgid, parent);
        }
      } catch (error) {
        console.warn("Reply parent log lookup failed:", error);
      }
    }

    let replyTo: { messageId: string; nick: string; preview: string; msgid?: string } | undefined;
    if (parent) {
      replyTo = {
        messageId: parent.messageId,
        nick: parent.nick,
        preview: parent.preview,
        msgid: replyToMsgid || undefined,
      };
    } else if (quoteNick) {
      replyTo = {
        messageId: "",
        nick: quoteNick,
        preview: quotePreview || "",
        msgid: replyToMsgid || undefined,
      };
    } else if (replyToMsgid) {
      // Graceful fallback for pure IRCv3 reply whose parent is not yet in active buffer
      replyTo = {
        messageId: "",
        nick: "Replied message",
        preview: `Referenced message (${replyToMsgid.slice(0, 8)}…)`,
        msgid: replyToMsgid,
      };
    }
    const ircMeta =
      msgid || replyToMsgid || replyTo
        ? {
            msgid: msgid || undefined,
            replyToMsgid: replyToMsgid || undefined,
            replyTo,
          }
        : undefined;

    if (replyTo?.nick) {
      const targetNick = replyTo.nick.toLowerCase();
      const trimmed = content.trimStart();
      const prefixes = [
        `@${targetNick}:`,
        `@${targetNick},`,
        `@${targetNick} `,
        `${targetNick}:`,
        `${targetNick},`,
      ];
      for (const prefix of prefixes) {
        if (trimmed.toLowerCase().startsWith(prefix)) {
          const rest = trimmed.slice(prefix.length).trimStart();
          if (rest.length > 0) {
            content = rest;
            break;
          }
        }
      }
    }

    if (!serverId) return;

    const activeServers = useMockStore.getState().servers;
    const targetServer = activeServers.find((s) => s.id === serverId);
    
    if (!targetServer) return;

    const isChannelMsg = channel.startsWith("#") || channel.startsWith("&");
    const msgTimestamp = payload.timestamp;
    const isDummySender = sender === "***" || !sender || !sender.trim();
    const effectiveIsSystem = isSystemMessage(sender, content, isSystem || isDummySender);
    if (!effectiveIsSystem) useTypingStore.getState().set(typingChatKey(serverId, isChannelMsg ? channel : sender), sender, false);

    if (effectiveIsSystem && !isChannelMsg && (!channel || !channel.trim() || channel === "*" || channel === "$server")) {
      const store = useMockStore.getState();
      const targetChan = targetServer.channels.find((c) => `channel:${c.id}` === store.activeChatKey) || targetServer.channels[0];
      if (targetChan) {
        const dummyMember = {
          id: `irc-${sender || "System"}`,
          profileId: `profile-${sender || "System"}`,
          profile: {
            id: `profile-${sender || "System"}`,
            userId: `user-${sender || "System"}`,
            name: sender || "System",
            imageUrl: "",
            email: "system@irc.local",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          serverId: targetServer.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addMessage(targetChan.id, dummyMember as any, content, null, true, { createdAt: msgTimestamp, logId: payload.log_id || undefined, ...ircMeta });
      }
      return;
    }

    if (!isChannelMsg) {
      // Private Message (PM)
      const store = useMockStore.getState();
      if (isSystem || sender === "System") {
        const targetNick = channel;
        const targetMember = store.addServerMember(targetServer.id, targetNick);
        const currentMember = getServerSelfMember(targetServer, store.currentProfile.id);

        if (targetMember && currentMember) {
          const conversationId = [currentMember.id, targetMember.id].sort().join("-");
          const systemMember = createSystemMember(targetServer.id);

          const lowerContent = content.toLowerCase();
          const isSendError =
            lowerContent.includes("cannot send message") ||
            lowerContent.startsWith("error:") ||
            lowerContent.includes("no such nick") ||
            lowerContent.includes("cannot send to user") ||
            lowerContent.includes("user not online");

          if (isSendError) {
            const restoredContent = store.removeLastDirectMessageFromMember(
              conversationId,
              currentMember.id
            );
            if (restoredContent) {
              useDraftStore.getState().setDraft(conversationId, {
                content: restoredContent,
                attachedImages: [],
              });
              window.dispatchEvent(
                new CustomEvent("restore_unsent_message", {
                  detail: { id: conversationId, content: restoredContent },
                })
              );
            }

            invoke("delete_last_log_entry", {
              serverId: targetServer.id,
              target: targetNick,
              sender: currentMember.profile.name,
            })
              .then(() => {
                invoke<string[]>("list_logged_conversations", {
                  serverId: targetServer.id,
                })
                  .then((loggedNicks) => {
                    store.syncActiveConversationsWithDisk(targetServer.id, loggedNicks);
                  })
                  .catch(console.error);
              })
              .catch(console.error);
          }

          const created = store.addDirectMessage(
            conversationId,
            systemMember as any,
            content,
            null,
            true,
            { createdAt: msgTimestamp, logId: payload.log_id || undefined, ...ircMeta }
          );
          applyIncomingIrcMeta(
            created.id,
            "System",
            content,
            msgid,
            replyToMsgid,
            replyTo ? { nick: replyTo.nick, preview: replyTo.preview } : undefined
          );
          store.openConversation(targetServer.id, targetMember.id);
          if (!isSendError) {
            store.addToHistoricalConversations(targetServer.id, targetMember.id);
          }
        }
        return;
      }

      const currentMember = getServerSelfMember(targetServer, store.currentProfile.id);
      const isSelf =
        (targetServer.nicknames && targetServer.nicknames.some((n) => n.toLowerCase() === sender.toLowerCase())) ||
        (currentMember?.profile?.name && currentMember.profile.name.toLowerCase() === sender.toLowerCase());

      const otherNick = isSelf ? channel : sender;
      let otherMember = store.addServerMember(targetServer.id, otherNick);

      if (otherMember && currentMember) {
        const conversationId = [currentMember.id, otherMember.id].sort().join("-");
        const authorMember = isSelf ? currentMember : otherMember;

        const created = store.addDirectMessage(
          conversationId,
          authorMember,
          content,
          null,
          false,
          { createdAt: msgTimestamp, logId: payload.log_id || undefined, ...ircMeta }
        );
        applyIncomingIrcMeta(
          created.id,
          sender,
          content,
          msgid,
          replyToMsgid,
          replyTo ? { nick: replyTo.nick, preview: replyTo.preview } : undefined
        );
        store.openConversation(targetServer.id, otherMember.id);
        store.addToHistoricalConversations(targetServer.id, otherMember.id);

        if (!isSelf) {
          const activeKey = store.activeChatKey;
          const isCurrentChat = activeKey === `conversation:${conversationId}`;
          let isWindowFocused = typeof document !== "undefined" && document.hasFocus();
          
          try {
            const { getCurrentWindow } = await import("@tauri-apps/api/window");
            const appWindow = getCurrentWindow();
            isWindowFocused = await appWindow.isFocused();
          } catch (e) {
            // Fallback to document.hasFocus()
          }

          if (!isCurrentChat || !isWindowFocused) {
            store.markUnread(`conversation:${conversationId}`, true);
          }

          if (!isCurrentChat || !isWindowFocused) {
            const globalNotif = store.notificationSettings;
            const serverNotif = targetServer.notificationSettings;
            const conversationNotif = store.conversationNotificationSettings[conversationId];

            const effectiveSettings = resolveEffectiveNotificationSettings(
              globalNotif,
              serverNotif,
              conversationNotif,
              true
            );

            if (effectiveSettings.shouldNotify()) {
              triggerIncomingNotification({
                title: `${sender} (Private Message)`,
                body: content,
                sender,
                tag: `dm:${targetServer.id}:${otherMember.id}`,
                effectiveSettings,
              });
            }
          }
        }
      }
      return;
    }

    const cleanName = channel.replace(/^#/, "").toLowerCase();
    const targetChannel = targetServer.channels.find(
      (c) => c.name.toLowerCase() === cleanName
    );

    if (isSystem || sender === "System") {
      const lowerContent = content.toLowerCase();
      const isSendError =
        lowerContent.includes("cannot send") ||
        lowerContent.startsWith("error:") ||
        lowerContent.includes("permission denied") ||
        lowerContent.includes("banned");

      if (isSendError && targetChannel) {
        const store = useMockStore.getState();
        const currentMember = targetServer.members.find(
          (m) => m.profileId === store.currentProfile.id
        ) || targetServer.members[0];

        if (currentMember) {
          const restoredContent = store.removeLastMessageFromChannel(
            targetChannel.id,
            currentMember.id
          );
          if (restoredContent) {
            useDraftStore.getState().setDraft(targetChannel.id, {
              content: restoredContent,
              attachedImages: [],
            });
            window.dispatchEvent(
              new CustomEvent("restore_unsent_message", {
                detail: { id: targetChannel.id, content: restoredContent },
              })
            );
          }
          invoke("delete_last_log_entry", {
            serverId: targetServer.id,
            target: targetChannel.name.startsWith("#") ? targetChannel.name : `#${targetChannel.name}`,
            sender: currentMember.profile.name,
          }).catch(console.error);
        }
      }
    }

    const mockMember = {
      id: `irc-${sender}`,
      profileId: `profile-${sender}`,
      profile: {
        id: `profile-${sender}`,
        userId: `user-${sender}`,
        name: sender,
        imageUrl: "",
        email: `${sender}@irc.local`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      serverId: targetServer.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (targetChannel) {
      const created = addMessage(
        targetChannel.id,
        mockMember as any,
        content,
        null,
        effectiveIsSystem,
        { createdAt: msgTimestamp, logId: payload.log_id || undefined, ...ircMeta }
      );
      applyIncomingIrcMeta(
        created.id,
        sender,
        content,
        msgid,
        replyToMsgid,
        replyTo ? { nick: replyTo.nick, preview: replyTo.preview } : undefined
      );
    } else if (targetServer.channels.length > 0) {
      const created = addMessage(
        targetServer.channels[0].id,
        mockMember as any,
        content,
        null,
        effectiveIsSystem,
        { createdAt: msgTimestamp, logId: payload.log_id || undefined, ...ircMeta }
      );
      applyIncomingIrcMeta(
        created.id,
        sender,
        content,
        msgid,
        replyToMsgid,
        replyTo ? { nick: replyTo.nick, preview: replyTo.preview } : undefined
      );
    }

    // Trigger notification for channel message
    const store = useMockStore.getState();
    const isSelf =
      sender.toLowerCase() === store.currentProfile.name.toLowerCase() ||
      (targetServer.nicknames && targetServer.nicknames.some((n) => n.toLowerCase() === sender.toLowerCase())) ||
      targetServer.members.some(
        (m) =>
          (m.profileId === store.currentProfile.id || m.profile?.id === store.currentProfile.id) &&
          m.profile?.name?.toLowerCase() === sender.toLowerCase()
      );

    if (!isSystem && sender !== "System" && !isSelf) {
      noteSpeaker(targetServer.id, sender);
      const activeKey = store.activeChatKey;
      const isCurrentChat = targetChannel && activeKey === `channel:${targetChannel.id}`;
      let isWindowFocused = typeof document !== "undefined" && document.hasFocus();
      
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const appWindow = getCurrentWindow();
        isWindowFocused = await appWindow.isFocused();
      } catch (e) {
        // Fallback to document.hasFocus()
      }

      const myNicks = Array.from(
        new Set(
          [
            getServerActiveNick(targetServer),
            targetServer.currentNick,
            ...(targetServer.nicknames || []),
            store.currentProfile?.name,
          ].filter(Boolean) as string[]
        )
      );
      const { highlightWords, enableHighlights } = useMockStore.getState();
      const hasMention = checkIsMention(content, enableHighlights ? [...myNicks, ...highlightWords] : myNicks);

      if (!isCurrentChat || !isWindowFocused) {
        if (targetChannel?.id) {
          store.markUnread(`channel:${targetChannel.id}`, hasMention);
        }
      }

      if (!isCurrentChat || !isWindowFocused) {
        const globalNotif = store.notificationSettings;
        const serverNotif = targetServer.notificationSettings;
        const channelNotif = targetChannel?.notificationSettings;

        const effectiveSettings = resolveEffectiveNotificationSettings(
          globalNotif,
          serverNotif,
          channelNotif,
          false
        );

        if (effectiveSettings.shouldNotify(hasMention)) {
          triggerIncomingNotification({
            title: `${sender} (${targetChannel?.name || channel})`,
            body: content,
            sender,
            tag: `chan:${targetServer.id}:${targetChannel?.id || channel}`,
            hasMention,
            effectiveSettings,
          });
        }
      }
    }
  }, [addMessage]);

  if (!multilineAccumulatorRef.current) {
    multilineAccumulatorRef.current = new IrcMultilineAccumulator((sId, target, senderNick, lines, isValid) => {
      if (isValid) {
        processIncomingPayload({
          serverId: sId,
          channel: target,
          sender: senderNick,
          content: lines.join("\n"),
          isSystem: false,
        });
      } else {
        for (const line of lines) {
          processIncomingPayload({
            serverId: sId,
            channel: target,
            sender: senderNick,
            content: line,
            isSystem: false,
          });
        }
      }
    });
  }

  // Listen for incoming messages across all connected IRC servers
  useEffect(() => {
    let isCancelled = false;
    const unlisteners: (() => void)[] = [];
    const registrations: Promise<void>[] = [];
    // Registers a backend event handler; unregisters it on cleanup (or at once if cleanup already ran).
    const listenSafe = <T,>(name: string, handler: (event: { payload: T }) => void) => {
      const registration = (async () => {
        try {
          const unlisten = await listen<T>(name, handler);
          if (isCancelled) unlisten();
          else unlisteners.push(unlisten);
        } catch (error) {
          console.error(`Failed to listen to ${name}:`, error);
        }
      })();
      registrations.push(registration);
      return registration;
    };
    listenSafe<IrcMessagePayload>("irc_message", (event) => {
      processIncomingPayload(event.payload);
    });

    listenSafe<{ serverId: string; sender: string; target: string; notice: boolean; body: string }>(
      "irc_avatar",
      (event) => handleAvatarEvent(event.payload)
    );

    listenSafe<{ serverId: string; target: string; sender: string; state: string }>("irc_typing", (event) => {
      const { serverId, target, sender, state } = event.payload;
      useTypingStore.getState().set(typingChatKey(serverId, target), sender, state === "active");
    });

    listenSafe<{ serverId: string; sender: string; target: string; notice: boolean; body: string }>(
      "irc_luna_hello",
      (event) => handleHelloEvent(event.payload)
    );

    listenSafe<{ serverId: string; target: string; sender: string; author: string; hash: string; emoji: string; add: boolean }>(
      "irc_reaction",
      (event) => {
        const { serverId, target, sender, author, hash, emoji, add } = event.payload;
        logLuna(serverId, "rx", `CTCP ${sender} LUNAREACT ${add ? "+" : "-"}${emoji} ${author} ${hash} ${target}`);
        useReactionStore
          .getState()
          .apply(reactionChatKey(serverId, target), `${author.toLowerCase()}|${hash}`, emoji, sender, add);
      }
    );

    listenSafe<IrcUserEventPayload>("irc_user_event", (event) => {
          const { server_id, channel, users, event_type } = event.payload;
          if (event_type === "PART" || event_type === "QUIT" || event_type === "KICK") {
            for (const user of users) useTypingStore.getState().set(typingChatKey(server_id, channel), user, false);
          }
          setTimeout(() => {
            updateChannelMembers(server_id, channel, users, event_type as any);
          }, 100);

          // Our own JOIN: the roster that follows can be dropped by the connect-time presence reset,
          // so ask for a fresh NAMES once the join has settled (same as the manual refresh button).
          const joinedNick = useMockStore.getState().servers.find((s) => s.id === server_id);
          if (event_type === "JOIN" && joinedNick && channel && users.some((u) => u.trim().replace(/^[~&@%+]+/, "").toLowerCase() === getServerActiveNick(joinedNick).toLowerCase())) {
            setTimeout(() => {
              invoke("refresh_channel_names", { serverId: server_id, channel }).catch(() => {});
            }, 500);
            announceHello(server_id, channel);
          }

          if (event_type === "JOIN" || event_type === "NAMES") {
            const store = useMockStore.getState();
            const pending = store.pendingJoin;
            const cleanChan = channel ? channel.replace(/^#/, "") : "";
            if (!cleanChan || !server_id) return;

            const activeServer = store.servers.find((s) => s.id === server_id);
            if (!activeServer) return;

            const ourNick = getServerActiveNick(activeServer).toLowerCase();
            const isOurNickInUsers = users.some(
              (u) => u.trim().replace(/^[~&@%+]+/, "").toLowerCase() === ourNick
            );
            const isPending =
              pending &&
              pending.serverId === server_id &&
              pending.channelName.toLowerCase() === cleanChan.toLowerCase();

            if (isPending || isOurNickInUsers || (event_type === "NAMES" && isOurNickInUsers)) {
              const existing = activeServer.channels.find(
                (c) => c.name.toLowerCase().replace(/^#/, "") === cleanChan.toLowerCase()
              );

              if (!existing) {
                const newChan = store.addChannel(server_id, cleanChan, ChannelType.TEXT);
                if (isPending && pending.password) {
                  store.updateChannelKey(server_id, newChan.id, pending.password);
                }
                if (isPending) {
                  store.setPendingJoin(null, null);
                }
                const isServerView =
                  window.location.pathname === `/servers/${server_id}` ||
                  window.location.pathname === `/servers/${server_id}/`;
                if (isPending || isServerView) {
                  if (newChan?.id) {
                    navigate(`/servers/${server_id}/channels/${newChan.id}`);
                  }
                }
              } else {
                if (isPending) {
                  if (pending.password) {
                    store.updateChannelKey(server_id, existing.id, pending.password);
                  }
                  store.setPendingJoin(null, null);
                  navigate(`/servers/${server_id}/channels/${existing.id}`);
                }
              }
            }
          }
        });

    listenSafe<IrcUserHostEventPayload>("irc_user_host_event", (event) => {
          const { server_id, nick, host, realname } = event.payload;
          if (server_id && nick && host) {
            useMockStore.getState().addServerMember(server_id, nick, realname, host);
          }
        });

    listenSafe<{ server_id: string; connected: boolean; error?: string }>(
          "irc_status",
          (event) => {
            const { server_id, connected, error } = event.payload;
            setIrcConnected(server_id, connected, error || null);
            if (connected) {
              attemptsRef.current.delete(server_id);
              nextReconnectTimeRef.current.delete(server_id);
              // Safety net: ask again for the rosters that are still empty (or only us) once the
              // autojoin has settled, so a lost or reset NAMES does not leave the list bare.
              setTimeout(() => {
                const state = useMockStore.getState();
                const server = state.servers.find((s) => s.id === server_id);
                if (!server || !state.ircConnectedServers[server_id]) return;
                for (const channel of server.channels) {
                  if ((state.channelMembers[channel.id]?.length ?? 0) > 1) continue;
                  invoke("refresh_channel_names", { serverId: server_id, channel: channel.name }).catch(() => {});
                }
              }, 3000);
            } else {
              connectedConfigsRef.current.delete(server_id);
            }
          }
        );

    listenSafe<{ server_id: string; welcome_nick: string }>(
          "irc_welcome_nick",
          (event) => {
            const { server_id, welcome_nick } = event.payload;
            if (server_id && welcome_nick) {
              useMockStore.getState().setServerActiveNick(server_id, welcome_nick);
            }
          }
        );

    listenSafe<{ server_id: string; old_nick: string; new_nick: string }>(
          "irc_nick_change",
          (event) => {
            const { server_id, old_nick, new_nick } = event.payload;
            if (server_id && old_nick && new_nick) {
              useMockStore.getState().handleNickChange(server_id, old_nick, new_nick);
              useTypingStore.getState().clearNick(server_id, old_nick);
            }
          }
        );

    listenSafe<{ server_id: string; channel: string; topic: string }>(
          "irc_topic_event",
          (event) => {
            const { server_id, channel, topic } = event.payload;
            useMockStore.getState().updateChannelTopicByName(server_id, channel, topic);
          }
        );

    listenSafe<{ server_id: string; channel: string; ops: string[] }>(
          "irc_ops_event",
          (event) => {
            const { server_id, channel, ops } = event.payload;
            useMockStore.getState().updateChannelOps(server_id, channel, ops);
          }
        );

    listenSafe<{ server_id: string; channel: string; error: string }>(
          "irc_topic_error",
          (event) => {
            const { server_id, channel, error } = event.payload;
            const chanName = channel ? `#${channel.replace(/^#/, "")}` : "this channel";

            if (server_id && channel) {
              invoke("refresh_channel_names", { serverId: server_id, channel }).catch(() => {});
            }

            useModalStore.getState().onOpen("ircError", {
              title: "Permission Denied",
              description: i18n.t("err.cannotOperate", { channel: chanName, error: error || i18n.t("err.operatorNeeded") }),
            });
          }
        );

    listenSafe<{ server_id: string; channel: string; error: string }>(
          "irc_bad_channel_key",
          (event) => {
            const { server_id, channel, error } = event.payload;
            const cleanChan = channel.replace(/^#/, "");

            // We purposefully do NOT delete the channel here, because if they had it
            // in their sidebar, we don't want to wipe their history just because the key was wrong or changed.
            
            const store = useMockStore.getState();
            const pending = store.pendingJoin;
            let isWrongPassword = false;
            if (pending && pending.serverId === server_id && pending.channelName.toLowerCase() === cleanChan.toLowerCase()) {
              isWrongPassword = !!pending.password;
              store.setPendingJoin(null, null);
            }

            useModalStore.getState().onOpen("joinChannelPassword", {
              serverId: server_id,
              channelName: cleanChan,
              errorMessage: isWrongPassword ? "Incorrect password." : (error || "Cannot join channel (+k): Password required."),
            });
          }
        );

    listenSafe<{ server_id: string; channel: string; error: string }>(
          "irc_invite_only",
          (event) => {
            const { server_id, channel, error } = event.payload;
            const cleanChan = channel.replace(/^#/, "");
            const formattedChan = channel.startsWith("#") || channel.startsWith("&") ? channel : `#${channel}`;

            const store = useMockStore.getState();
            store.setChannelTemporary(server_id, cleanChan, true);

            const pending = store.pendingJoin;
            if (
              pending &&
              pending.serverId === server_id &&
              pending.channelName.toLowerCase() === cleanChan.toLowerCase()
            ) {
              store.setPendingJoin(null, null);
            }

            useModalStore.getState().onOpen("ircError", {
              title: "Cannot join channel",
              description: `Cannot join ${formattedChan}: ${error || "Cannot join channel (+i)"}.`,
            });
          }
        );

    listenSafe<{ server_id: string; channel: string; inviter: string }>(
          "irc_invited",
          (event) => {
            const { server_id, channel, inviter } = event.payload;
            useMockStore.getState().addPendingInvite(server_id, channel, inviter);
          }
        );

    listenSafe<{ server_id: string; channel: string; modes: string; set_by?: string; is_full_listing?: boolean }>(
          "irc_mode_event",
          (event) => {
            const { server_id, channel, modes, is_full_listing } = event.payload;
            useMockStore.getState().updateChannelModes(server_id, channel, modes, is_full_listing);
          }
        );

    listenSafe<{ server_id: string; channel: string; error: string }>(
          "irc_mode_error",
          (event) => {
            const { server_id, channel, error } = event.payload;
            const chanName = channel ? (channel.startsWith("#") || channel.startsWith("&") ? channel : `#${channel}`) : "this channel";

            if (server_id && channel) {
              const chanTarget = channel.startsWith("#") || channel.startsWith("&") ? channel : `#${channel}`;
              invoke("send_mode", {
                serverId: server_id,
                target: chanTarget,
                mode: null,
                params: null,
              }).catch(() => {});
            }

            const extractedFlag = extractFlag(error);
            useModalStore.getState().onOpen("ircError", {
              title: "Channel mode error",
              description: `Cannot set mode on ${chanName}: ${error || "Server does not support this mode flag or permission was denied."}`,
              flag: extractedFlag || undefined,
            });
          }
        );

    listenSafe<{ server_id: string; motd: string[] }>(
          "irc_motd_event",
          (event) => {
            const { server_id, motd } = event.payload;
            const store = useMockStore.getState();
            store.setServerMotd(server_id, motd);
          }
        );

    listenSafe<{ server_id: string; nick: string; away: boolean; reason?: string }>(
          "irc_away_event",
          (event) => {
            const { server_id, nick, away, reason } = event.payload;
            const store = useMockStore.getState();
            store.setUserAway(server_id, nick, away, reason);

            const server = store.servers.find((s) => s.id === server_id);
            const ourNick = server ? getServerActiveNick(server) : store.currentProfile.name;
            if (nick.toLowerCase() === ourNick.toLowerCase()) {
              store.setSelfAway(server_id, away, reason);
            }
          }
        );

    const messageEventUnlisteners: Array<() => void> = [];
    const setupMessageModificationListeners = async () => {
      try {
        const unlistenCaps = await listen<{ serverId: string; edit: boolean; redact: boolean }>(
          "irc_caps",
          (event) => {
            const { serverId, edit, redact } = event.payload;
            useMessageCapsStore.getState().setCaps(serverId, { edit, redact });
          }
        );
        const unlistenEdit = await listen<{
          serverId: string;
          sender: string;
          msgid: string;
          content: string;
        }>("irc_message_edit", (event) => {
          const { msgid, sender, content } = event.payload;
          useMockStore.getState().applyMessageEdit(msgid, sender, content);
        });
        const unlistenRedact = await listen<{ serverId: string; msgid: string }>(
          "irc_message_redact",
          (event) => {
            useMockStore.getState().applyMessageRedaction(event.payload.msgid);
          }
        );
        const all = [unlistenCaps, unlistenEdit, unlistenRedact];
        if (isCancelled) {
          all.forEach((fn) => fn());
        } else {
          messageEventUnlisteners.push(...all);
        }
      } catch (error) {
        console.error("Failed to setup message edit/redact listeners:", error);
      }
    };

    registrations.push(setupMessageModificationListeners());

    listenSafe<{
          serverId: string;
          channel: string;
          localId: string;
          msgid: string;
        }>("irc_self_msgid", (event) => {
          const { localId, msgid } = event.payload;
          if (!localId || !msgid) return;
          const store = useMockStore.getState();
          store.updateMessageMsgid(localId, msgid);

          let previewContent = "";
          let senderNick = "";
          for (const msgs of Object.values(store.messages)) {
            const m = msgs.find((x) => x.id === localId);
            if (m) {
              previewContent = m.content;
              senderNick = m.member?.profile?.name || "You";
              break;
            }
          }
          if (!senderNick) {
            for (const msgs of Object.values(store.directMessages)) {
              const m = msgs.find((x) => x.id === localId);
              if (m) {
                previewContent = m.content;
                senderNick = m.member?.profile?.name || "You";
                break;
              }
            }
          }
          useReplyStore.getState().indexMsgid(msgid, {
            messageId: localId,
            nick: senderNick || "You",
            preview: previewContent,
          });
        });

    // The 3 s cap only matters if a registration hangs: connecting without some listener beats never connecting.
    void Promise.race([Promise.all(registrations), new Promise((done) => setTimeout(done, 3000))]).then(() =>
      listenersReadyRef.current?.resolve()
    );

    return () => {
      isCancelled = true;
      messageEventUnlisteners.forEach((fn) => fn());
      unlisteners.forEach((fn) => fn());
    };
  }, [addMessage, addServerMember, removeServerMember, setIrcConnected]);

  return <>{children}</>;
};
