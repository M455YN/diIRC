import i18n from "@/lib/i18n";
import { invoke } from "@tauri-apps/api/core";
import { CustomCommand, Member, Server } from "@/types";
import { inviteUserToChannel } from "@/lib/irc-actions";
import { dedentCode, detectCodeLanguage } from "@/lib/markdown/markdown-utils";
import { getIrcByteCount, getIrcMaxMessageBytes } from "@/lib/system-utils";

export interface CommandContext {
  serverId: string;
  channelName: string;
  channelId?: string;
  conversationId?: string;
  targetMemberId?: string;
  type: "channel" | "conversation";
  currentMember: Member;
  activeServer: Server;
  addMessage: (channelId: string, member: Member, content: string) => void;
  addDirectMessage: (conversationId: string, member: Member, content: string, fileUrl?: string | null, isSystem?: boolean) => void;
  navigate?: (path: string) => void;
  setInputContent?: (content: string, cursorPosition?: number) => void;
}

export interface SlashCommand {
  name: string;
  description: string;
  execute: (args: string, ctx: CommandContext) => Promise<boolean | void> | boolean | void;
}

export function normalizeCommandTrigger(trigger: string): string {
  return trigger.trim().replace(/^\//, "").toLowerCase();
}

export function expandCustomCommand(
  input: string,
  customs: CustomCommand[] | undefined
): string | null {
  if (!customs?.length) return null;

  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;

  const withoutSlash = trimmed.slice(1);
  const spaceIdx = withoutSlash.search(/\s/);
  const name = normalizeCommandTrigger(spaceIdx === -1 ? withoutSlash : withoutSlash.slice(0, spaceIdx));
  const args = spaceIdx === -1 ? "" : withoutSlash.slice(spaceIdx + 1).trim();

  if (!name) return null;

  const match = customs.find(
    (c) => normalizeCommandTrigger(c.trigger) === name && c.message.trim()
  );
  if (!match) return null;

  const template = match.message.trim();
  if (/\$\*|\$args/i.test(template)) {
    return template.replace(/\$\*|\$args/gi, args).replace(/[ \t]+/g, " ").trim();
  }
  return args ? `${template} ${args}` : template;
}

export interface CommandSuggestionItem {
  insert: string;
  label: string;
  description: string;
}

export function listSlashSuggestions(
  input: string,
  customs: CustomCommand[] | undefined
): CommandSuggestionItem[] {
  if (!input.startsWith("/")) return [];

  const rest = input.slice(1);
  const spaceIdx = rest.search(/\s/);
  const reserved = new Set(commandRegistry.getAll().map((c) => c.name.toLowerCase()));

  if (spaceIdx === -1) {
    const q = rest.toLowerCase();
    const items: CommandSuggestionItem[] = [];

    for (const cmd of commandRegistry.getAll()) {
      if (q && !cmd.name.toLowerCase().includes(q)) continue;
      items.push({
        insert: `/${cmd.name} `,
        label: `/${cmd.name}`,
        description: cmd.description,
      });
    }

    for (const c of customs || []) {
      const name = normalizeCommandTrigger(c.trigger);
      const message = c.message.trim();
      if (!name || !message || reserved.has(name)) continue;
      if (q && !name.includes(q)) continue;

      const presets = (c.suggestions || []).map((s) => s.trim()).filter(Boolean);
      const userDescription = (c.description || "").trim();

      if (q === name && presets.length > 0) {
        for (const arg of presets) {
          const slashLine = `/${name} ${arg}`;
          const sent = expandCustomCommand(slashLine, [c]) || `${message} ${arg}`;
          items.push({
            insert: slashLine,
            label: slashLine,
            description: userDescription
              ? `${userDescription} · ${i18n.t("cmd.sendsMessage", { message: sent })}`
              : i18n.t("cmd.sendsMessage", { message: sent }),
          });
        }
        continue;
      }

      const hint = userDescription
        ? userDescription
        : presets.length > 0
        ? i18n.t("cmd.sendsPresets", { message, presets: presets.slice(0, 3).join(", ") + (presets.length > 3 ? "…" : "") })
        : i18n.t("cmd.sendsMessage", { message });
      items.push({
        insert: `/${name} `,
        label: `/${name}`,
        description: hint,
      });
    }

    return items;
  }

  const cmdName = normalizeCommandTrigger(rest.slice(0, spaceIdx));
  const argQuery = rest.slice(spaceIdx + 1);

  const custom = (customs || []).find(
    (c) => normalizeCommandTrigger(c.trigger) === cmdName && !reserved.has(cmdName)
  );
  if (!custom) return [];

  const presets = (custom.suggestions || []).map((s) => s.trim()).filter(Boolean);
  if (!presets.length) return [];

  const aq = argQuery.toLowerCase();
  const userDescription = (custom.description || "").trim();
  return presets
    .filter((arg) => !aq || arg.toLowerCase().startsWith(aq) || arg.toLowerCase().includes(aq))
    .map((arg) => {
      const slashLine = `/${cmdName} ${arg}`;
      const sent = expandCustomCommand(slashLine, [custom]) || `${custom.message.trim()} ${arg}`;
      return {
        insert: slashLine,
        label: slashLine,
        description: userDescription
          ? `${userDescription} · ${i18n.t("cmd.sendsMessage", { message: sent })}`
          : i18n.t("cmd.sendsMessage", { message: sent }),
      };
    });
}

class CommandRegistry {
  private commands = new Map<string, SlashCommand>();

  public register(command: SlashCommand) {
    this.commands.set(command.name.toLowerCase(), command);
  }

  public get(name: string): SlashCommand | undefined {
    return this.commands.get(name.toLowerCase());
  }

  public getAll(): SlashCommand[] {
    return Array.from(this.commands.values());
  }

  public async execute(input: string, ctx: CommandContext): Promise<boolean> {
    const trimmed = input.trim();
    if (!trimmed.startsWith("/")) return false;

    const parts = trimmed.slice(1).split(/\s+/);
    const commandName = parts[0]?.toLowerCase();
    const args = trimmed.slice(1 + (parts[0]?.length || 0)).trim();

    if (!commandName) return false;

    const command = this.get(commandName);
    if (command) {
      await command.execute(args, ctx);
      return true;
    }

    return false;
  }
}

export const commandRegistry = new CommandRegistry();

// Register default commands
commandRegistry.register({
  name: "me",
  description: "cmd.desc.me",
  execute: async (args: string, ctx: CommandContext) => {
    const actionText = args.trim();
    if (!actionText) return;

    const ctcpAction = `\x01ACTION ${actionText.replace(/\r?\n/g, "\u0085")}\x01`;

    if (ctx.type === "channel" && ctx.channelId) {
      const channelTarget = ctx.channelName.startsWith("#") ? ctx.channelName : `#${ctx.channelName}`;
      try {
        await invoke("send_message", {
          serverId: ctx.serverId,
          channel: channelTarget,
          message: ctcpAction,
          replyToMsgid: null,
        replyNick: null,
        replyPreview: null,
        replyParentOffset: null,
        });
        ctx.addMessage(ctx.channelId, ctx.currentMember, ctcpAction);
      } catch (err) {
        console.error("Failed to send /me channel action via Tauri IRC:", err);
      }
    } else if (ctx.type === "conversation" && ctx.conversationId) {
      try {
        await invoke("send_message", {
          serverId: ctx.serverId,
          channel: ctx.channelName,
          message: ctcpAction,
          replyToMsgid: null,
        replyNick: null,
        replyPreview: null,
        replyParentOffset: null,
        });
        ctx.addDirectMessage(ctx.conversationId, ctx.currentMember, ctcpAction);
        if (ctx.targetMemberId) {
          const { useMockStore } = await import("@/lib/mock-store");
          useMockStore.getState().addToHistoricalConversations(ctx.serverId, ctx.targetMemberId);
        }
      } catch (err) {
        console.error("Failed to send /me direct action via Tauri IRC:", err);
      }
    }
  },
});

commandRegistry.register({
  name: "join",
  description: "cmd.desc.join",
  execute: async (args: string, ctx: CommandContext) => {
    const parts = args.trim().split(/\s+/);
    if (!parts[0]) return;

    const channelName = parts[0].replace(/^#/, "");
    const password = parts[1] || null;

    try {
      const { useMockStore } = await import("@/lib/mock-store");
      const { ChannelType } = await import("@/types");
      useMockStore.getState().setPendingJoin(ctx.serverId, channelName, password || undefined);
      const newChan = useMockStore.getState().addChannel(ctx.serverId, channelName, ChannelType.TEXT);
      if (password) {
        useMockStore.getState().updateChannelKey(ctx.serverId, newChan.id, password);
      }
      
      await invoke("join_channel", {
        serverId: ctx.serverId,
        channel: channelName,
        password: password,
      });

      if (newChan?.id && ctx.navigate) {
        ctx.navigate(`/servers/${ctx.serverId}/channels/${newChan.id}`);
      }
    } catch (err) {
      console.error("Failed to send /join via Tauri IRC:", err);
    }
  },
});

commandRegistry.register({
  name: "invite",
  description: "cmd.desc.invite",
  execute: async (args: string, ctx: CommandContext) => {
    const parts = args.trim().split(/\s+/).filter(Boolean);
    if (!parts[0]) return;

    const nickname = parts[0];
    let channelTarget = parts[1] || "";

    if (!channelTarget) {
      if (ctx.type === "channel" && ctx.channelName) {
        channelTarget = ctx.channelName;
      } else {
        return;
      }
    }

    await inviteUserToChannel(ctx.serverId, nickname, channelTarget);
  },
});

commandRegistry.register({
  name: "mode",
  description: "cmd.desc.mode",
  execute: async (args: string, ctx: CommandContext) => {
    const trimmed = args.trim();
    let target = "";
    let modeStr: string | null = null;
    let params: string[] | null = null;

    if (!trimmed) {
      if (ctx.type === "channel" && ctx.channelName) {
        target = ctx.channelName.startsWith("#") ? ctx.channelName : `#${ctx.channelName}`;
      } else {
        return;
      }
    } else {
      const parts = trimmed.split(/\s+/);
      if (parts[0].startsWith("#") || parts[0].startsWith("&")) {
        target = parts[0];
        if (parts.length > 1) {
          modeStr = parts[1];
          if (parts.length > 2) {
            params = parts.slice(2);
          }
        }
      } else {
        if (ctx.type === "channel" && ctx.channelName) {
          target = ctx.channelName.startsWith("#") ? ctx.channelName : `#${ctx.channelName}`;
          modeStr = parts[0];
          if (parts.length > 1) {
            params = parts.slice(1);
          }
        } else {
          return;
        }
      }
    }

    await sendMode(ctx.serverId, target, modeStr, params);
  },
});

async function sendMode(serverId: string, target: string, mode: string | null, params: string[] | null) {
  try {
    await invoke("send_mode", {
      serverId,
      target,
      mode,
      params,
    });
  } catch (err) {
    console.error("Failed to send /mode via Tauri IRC:", err);
    invoke("refresh_channel_names", { serverId, channel: target }).catch(() => {});
  }
}

async function handleRoleMode(flag: string, args: string, ctx: CommandContext) {
  const trimmed = args.trim();
  if (!trimmed) return;

  const parts = trimmed.split(/\s+/);
  let target = "";
  let nicks: string[] = [];

  if (parts[0].startsWith("#") || parts[0].startsWith("&")) {
    target = parts[0];
    nicks = parts.slice(1);
  } else {
    if (ctx.type === "channel" && ctx.channelName) {
      target = ctx.channelName.startsWith("#") ? ctx.channelName : `#${ctx.channelName}`;
      nicks = parts;
    } else {
      return;
    }
  }

  if (nicks.length === 0) return;

  const sign = flag[0];
  const modeChar = flag.slice(1);
  const modeStr = sign + modeChar.repeat(nicks.length);

  await sendMode(ctx.serverId, target, modeStr, nicks);
}

commandRegistry.register({
  name: "op",
  description: "cmd.desc.op",
  execute: (args: string, ctx: CommandContext) => handleRoleMode("+o", args, ctx),
});

commandRegistry.register({
  name: "deop",
  description: "cmd.desc.deop",
  execute: (args: string, ctx: CommandContext) => handleRoleMode("-o", args, ctx),
});

commandRegistry.register({
  name: "voice",
  description: "cmd.desc.voice",
  execute: (args: string, ctx: CommandContext) => handleRoleMode("+v", args, ctx),
});

commandRegistry.register({
  name: "devoice",
  description: "cmd.desc.devoice",
  execute: (args: string, ctx: CommandContext) => handleRoleMode("-v", args, ctx),
});

commandRegistry.register({
  name: "query",
  description: "cmd.desc.query",
  execute: async (args: string, ctx: CommandContext) => {
    const trimmed = args.trim();
    if (!trimmed) {
      const { useModalStore } = await import("@/hooks/use-modal-store");
      useModalStore.getState().onOpen("privateMessages", { serverId: ctx.serverId });
      return true;
    }

    const parts = trimmed.split(/\s+/);
    const rawNick = parts[0];
    if (!rawNick) {
      const { useModalStore } = await import("@/hooks/use-modal-store");
      useModalStore.getState().onOpen("privateMessages", { serverId: ctx.serverId });
      return true;
    }

    const cleanNick = rawNick.replace(/^@/, "");
    const initialMessage = parts.slice(1).join(" ").trim();

    const { useMockStore } = await import("@/lib/mock-store");
    const store = useMockStore.getState();

    const targetMember = store.addServerMember(ctx.serverId, cleanNick);
    if (!targetMember) return true;

    store.openConversation(ctx.serverId, targetMember.id);

    if (initialMessage) {
      const conversationId = [ctx.currentMember.id, targetMember.id].sort().join("-");
      const ircMessage = initialMessage.replace(/\r?\n/g, "\u0085");
      try {
        await invoke("send_message", {
          serverId: ctx.serverId,
          channel: cleanNick,
          message: ircMessage,
          replyToMsgid: null,
        replyNick: null,
        replyPreview: null,
        replyParentOffset: null,
        });
        ctx.addDirectMessage(conversationId, ctx.currentMember, initialMessage);
      } catch (err) {
        console.error("Failed to send /query message via Tauri IRC:", err);
      }
    }

    if (ctx.navigate) {
      ctx.navigate(`/servers/${ctx.serverId}/conversations/${targetMember.id}`);
    }

    return true;
  },
});

commandRegistry.register({
  name: "code",
  description: "cmd.desc.code",
  execute: async (args: string, ctx: CommandContext) => {
    const cleanedCode = dedentCode(args.trim());
    let detectedLang = detectCodeLanguage(cleanedCode) || "";

    if (detectedLang) {
      const channelTarget = ctx.type === "channel"
        ? (ctx.channelName.startsWith("#") ? ctx.channelName : `#${ctx.channelName}`)
        : ctx.channelName;
      const ourNick = ctx.activeServer.nicknames?.[0] || ctx.currentMember.profile.name || "user";
      const ourUser = ctx.activeServer.realname || ourNick;
      const ourHost = ctx.activeServer.host || "localhost";

      const maxBytes = getIrcMaxMessageBytes(channelTarget, ourNick, ourUser, ourHost);
      const codeMessageWithLang = `\`\`\`${detectedLang}\n${cleanedCode}\n\`\`\``;
      const codeMessageNoLang = `\`\`\`\n${cleanedCode}\n\`\`\``;

      if (getIrcByteCount(codeMessageWithLang) > maxBytes && getIrcByteCount(codeMessageNoLang) <= maxBytes) {
        detectedLang = "";
      }
    }

    const codeMessage = `\`\`\`${detectedLang}\n${cleanedCode}\n\`\`\``;
    const ircMessage = codeMessage.replace(/\r?\n/g, "\u0085");

    if (ctx.type === "channel" && ctx.channelId) {
      const channelTarget = ctx.channelName.startsWith("#") ? ctx.channelName : `#${ctx.channelName}`;
      try {
        await invoke("send_message", {
          serverId: ctx.serverId,
          channel: channelTarget,
          message: ircMessage,
          replyToMsgid: null,
          replyNick: null,
          replyPreview: null,
          replyParentOffset: null,
        });
        ctx.addMessage(ctx.channelId, ctx.currentMember, codeMessage);
      } catch (err) {
        console.error("Failed to send /code channel message via Tauri IRC:", err);
      }
    } else if (ctx.type === "conversation" && ctx.conversationId) {
      try {
        await invoke("send_message", {
          serverId: ctx.serverId,
          channel: ctx.channelName,
          message: ircMessage,
          replyToMsgid: null,
          replyNick: null,
          replyPreview: null,
          replyParentOffset: null,
        });
        ctx.addDirectMessage(ctx.conversationId, ctx.currentMember, codeMessage);
        if (ctx.targetMemberId) {
          const { useMockStore } = await import("@/lib/mock-store");
          useMockStore.getState().addToHistoricalConversations(ctx.serverId, ctx.targetMemberId);
        }
      } catch (err) {
        console.error("Failed to send /code direct message via Tauri IRC:", err);
      }
    }
    return true;
  },
});

commandRegistry.register({
  name: "motd",
  description: "cmd.desc.motd",
  execute: async (_args: string, ctx: CommandContext) => {
    try {
      invoke("request_motd", { serverId: ctx.serverId }).catch(() => {});
      const { useModalStore } = await import("@/hooks/use-modal-store");
      useModalStore.getState().onOpen("motd", {
        serverId: ctx.serverId,
        server: ctx.activeServer,
      });
    } catch (err) {
      console.error("Failed to execute /motd command:", err);
    }
    return true;
  },
});

commandRegistry.register({
  name: "away",
  description: "cmd.desc.away",
  execute: async (args: string, ctx: CommandContext) => {
    const { useMockStore } = await import("@/lib/mock-store");
    const store = useMockStore.getState();
    const isAlreadyAway = !!store.selfAway[ctx.serverId];

    if (isAlreadyAway) {
      const { useModalStore } = await import("@/hooks/use-modal-store");
      useModalStore.getState().onOpen("alreadyAway", { serverId: ctx.serverId });
      return true;
    }

    const reason = args.trim();
    try {
      await invoke("send_away", {
        serverId: ctx.serverId,
        reason: reason || "Away",
      });
    } catch (err) {
      console.error("Failed to send /away via Tauri IRC:", err);
    }

    const ourNick = ctx.activeServer.nicknames?.[0] || store.currentProfile.name;
    store.setUserAway(ctx.serverId, ourNick, true, reason);
    store.setSelfAway(ctx.serverId, true);
    return true;
  },
});

commandRegistry.register({
  name: "back",
  description: "cmd.desc.back",
  execute: async (_args: string, ctx: CommandContext) => {
    const { useMockStore } = await import("@/lib/mock-store");
    const store = useMockStore.getState();

    try {
      await invoke("send_away", {
        serverId: ctx.serverId,
        reason: null,
      });
    } catch (err) {
      console.error("Failed to send /back via Tauri IRC:", err);
    }

    const ourNick = ctx.activeServer.nicknames?.[0] || store.currentProfile.name;
    store.setUserAway(ctx.serverId, ourNick, false);
    store.setSelfAway(ctx.serverId, false);
    return true;
  },
});



