import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import { useMockStore, getServerActiveNick } from "@/lib/mock-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ActionTooltip } from "@/components/action-tooltip";

export type PanelCommand = "mode" | "op" | "deop" | "voice" | "devoice" | "invite" | "query" | "away" | "join";

/**
 * Flags that take no parameter and are toggled with a switch.
 * `r` (registered channel) is left out on purpose: only the server or services may set it,
 * so offering it made the server reject the command with "Only servers can change that mode".
 */
const SWITCH_FLAGS = ["n", "t", "m", "i", "s", "p"] as const;

/** Commands that only operators may run in a channel. */
const NEEDS_OP: PanelCommand[] = ["mode", "op", "deop", "voice", "devoice"];
/** Commands that need a channel as their target. */
const NEEDS_CHANNEL: PanelCommand[] = ["mode", "op", "deop", "voice", "devoice", "invite"];

// IRC nicks cannot contain dots, so entries such as server hostnames are filtered out of the lists.
const isNick = (name: string) => /^[A-Za-z\[\]\\`_^{|}][A-Za-z0-9\[\]\\`_^{|}-]*$/.test(name);

const EMPTY: never[] = [];
const EMPTY_MODES: Record<string, string[]> = {};
const isOperatorModes = (modes: string[]) => modes.some((m) => ["o", "a", "q"].includes(m.toLowerCase()));

export const panelNeedsChannel = (command: PanelCommand) => NEEDS_CHANNEL.includes(command);

interface CommandPanelProps {
  command: PanelCommand;
  serverId: string;
  /** Empty for commands that work outside a channel (/query). */
  channelId: string;
  /** Channel name with the leading # (empty when there is no channel). */
  channelName: string;
  onSend: (text: string) => void;
  onClose: () => void;
}

/**
 * Small panel that opens when a command is picked from the suggestions.
 * /mode builds a diff from the current channel modes; /op, /deop, /voice, /devoice, /invite and /query
 * list people and send on click.
 */
export const CommandPanel = ({ command, serverId, channelId, channelName, onSend, onClose }: CommandPanelProps) => {
  const { t } = useTranslation();
  const server = useMockStore((state) => state.servers.find((s) => s.id === serverId));
  const connected = useMockStore((state) => !!state.ircConnectedServers[serverId]);
  const members = useMockStore((state) => (channelId ? state.channelMembers[channelId] : undefined)) ?? EMPTY;
  const userModes = useMockStore((state) => (channelId ? state.channelUserModes[channelId] : undefined)) ?? EMPTY_MODES;
  const channelOps = useMockStore((state) => (channelId ? state.channelOps[channelId] : undefined)) ?? EMPTY;
  const flags = useMockStore((state) => (channelId ? state.channelModes[channelId] : undefined)) ?? EMPTY;
  const selfAway = useMockStore((state) => !!state.selfAway[serverId]);

  const ourNick = server ? getServerActiveNick(server).toLowerCase() : "";
  const isOp =
    channelOps.some((op) => op.toLowerCase() === ourNick) || isOperatorModes(userModes[ourNick] ?? EMPTY);
  const needsOp = NEEDS_OP.includes(command);
  const canAct = connected && (!needsOp || isOp);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = t(`cp.title.${command}`);

  // A click outside the composer (another channel, the sidebar, the message list) closes it.
  // Clicks in the composer itself keep it open, so the user can keep typing.
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      // composedPath is read before any handler re-renders, so a suggestion item that unmounts
      // on click still counts as inside the composer.
      const path = e.composedPath();
      if (!rootRef.current) return;
      if (path.includes(rootRef.current)) return;
      const composer = rootRef.current.closest("form");
      if (composer && path.includes(composer)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose]);

  return (
    <div ref={rootRef} className="popover-surface absolute bottom-full left-4 mb-2 w-[26rem] max-w-[calc(100vw-2rem)] bg-white dark:bg-[#2b2d31] border border-zinc-200 dark:border-zinc-800 rounded-md shadow-xl overflow-hidden z-50">
      <div className="px-3 py-2 text-xs font-bold text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-[#232428] border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <span className="truncate">{channelName ? `${title} · ${channelName}` : title}</span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("cp.close")}
          className="p-0.5 rounded-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {!connected && <Notice text={t("cp.notConnected")} />}
      {connected && needsOp && !isOp && <Notice text={t("cp.notOp")} />}

      {command === "mode" && (
        <ModePanel channelName={channelName} flags={flags} canAct={canAct} onSend={onSend} onClose={onClose} />
      )}

      {command === "away" && <AwayPanel isAway={selfAway} canAct={connected} onSend={onSend} />}
      {command === "join" && <JoinPanel serverId={serverId} canAct={connected} onSend={onSend} />}

      {command !== "mode" && command !== "away" && command !== "join" && (
        <MemberPanel
          command={command}
          channelName={channelName}
          channelMembers={members}
          userModes={userModes}
          channelOps={channelOps}
          serverMembers={server?.members.map((m) => m.profile.name) ?? EMPTY}
          ourNick={ourNick}
          canAct={canAct}
          onSend={onSend}
        />
      )}
    </div>
  );
};

const AWAY_PRESETS = ["cp.away.brb", "cp.away.lunch", "cp.away.afk"] as const;

/** /away presets and free reason; when already away it only offers /back. */
const AwayPanel = ({ isAway, canAct, onSend }: { isAway: boolean; canAct: boolean; onSend: (text: string) => void }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");

  if (isAway) {
    return (
      <div className="p-3 space-y-2">
        <p className="text-xs text-zinc-600 dark:text-zinc-300">{t("cp.away.current")}</p>
        <div className="flex justify-end">
          <ActionTooltip label={t("away.backTooltip")} side="top">
            <Button type="button" size="sm" disabled={!canAct} onClick={() => onSend("/back")}>
              {t("cp.away.back")}
            </Button>
          </ActionTooltip>
        </div>
      </div>
    );
  }

  const send = (text: string) => {
    const clean = text.trim();
    onSend(clean ? `/away ${clean}` : "/away");
  };

  return (
    <div className="p-3 space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {AWAY_PRESETS.map((key) => (
          <button
            key={key}
            type="button"
            disabled={!canAct}
            onClick={() => send(t(key))}
            className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-1 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {t(key)}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-x-2">
        <Input
          disabled={!canAct}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends the reason; it must not submit the chat composer form around this panel.
            if (e.key === "Enter") {
              e.preventDefault();
              send(reason);
            }
          }}
          placeholder={t("cp.away.reason")}
          className="h-7 text-xs"
        />
        <Button type="button" size="sm" disabled={!canAct} onClick={() => send(reason)}>
          {t("cp.away.set")}
        </Button>
      </div>
    </div>
  );
};

const RECENT_KEY = "diirc-recent-channels";

/** Recently joined channels per server, kept locally (the app does not store parted channels). */
const readRecent = (serverId: string): string[] => {
  try {
    const all = JSON.parse(localStorage.getItem(RECENT_KEY) || "{}") as Record<string, string[]>;
    return all[serverId] ?? [];
  } catch {
    return [];
  }
};

const rememberRecent = (serverId: string, name: string) => {
  try {
    const all = JSON.parse(localStorage.getItem(RECENT_KEY) || "{}") as Record<string, string[]>;
    all[serverId] = [name, ...(all[serverId] ?? []).filter((n) => n !== name)].slice(0, 8);
    localStorage.setItem(RECENT_KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable: the recent list is optional, joining still works.
  }
};

/** /join #channel [password]; the server takes the channel and an optional key. */
const JoinPanel = ({ serverId, canAct, onSend }: { serverId: string; canAct: boolean; onSend: (text: string) => void }) => {
  const { t } = useTranslation();
  const [channel, setChannel] = useState("");
  const [password, setPassword] = useState("");
  const recent = useMemo(() => readRecent(serverId), [serverId]);

  const name = channel.trim().replace(/^#/, "");
  const key = password.trim();
  const invalid = /\s/.test(name) || /\s/.test(key);
  const canSubmit = canAct && name.length > 0 && !invalid;

  const submit = () => {
    if (!canSubmit) return;
    rememberRecent(serverId, name);
    onSend(key ? `/join #${name} ${key}` : `/join #${name}`);
  };

  return (
    <div className="p-3 space-y-2">
      <Input
        autoFocus
        disabled={!canAct}
        value={channel}
        onChange={(e) => setChannel(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={t("cp.join.channel")}
        className="h-7 text-xs"
      />
      <Input
        disabled={!canAct}
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={t("cp.join.password")}
        className="h-7 text-xs"
      />
      {invalid && <p className="text-[11px] text-amber-600 dark:text-amber-400">{t("cp.join.invalid")}</p>}

      {recent.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400">{t("cp.join.recent")}</div>
          <div className="flex flex-wrap gap-1.5">
            {recent.map((name) => (
              <button
                key={name}
                type="button"
                disabled={!canAct}
                onClick={() => setChannel(`#${name}`)}
                className="rounded-md border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 disabled:opacity-50 transition"
              >
                #{name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button type="button" size="sm" disabled={!canSubmit} onClick={submit}>
          {t("cp.join.submit")}
        </Button>
      </div>
    </div>
  );
};

const Notice = ({ text }: { text: string }) => (
  <div className="px-3 py-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 border-b border-amber-500/20">
    {text}
  </div>
);

const ModePanel = ({
  channelName,
  flags,
  canAct,
  onSend,
  onClose,
}: {
  channelName: string;
  flags: string[];
  canAct: boolean;
  onSend: (text: string) => void;
  onClose: () => void;
}) => {
  const { t } = useTranslation();
  const current = useMemo(() => new Set(flags.map((f) => f.toLowerCase())), [flags]);

  const [wanted, setWanted] = useState<Set<string>>(() => new Set(current));
  const [keyOn, setKeyOn] = useState(current.has("k"));
  const [keyValue, setKeyValue] = useState("");
  const [limitOn, setLimitOn] = useState(current.has("l"));
  const [limitValue, setLimitValue] = useState("");

  const keyWasSet = current.has("k");
  const limitWasSet = current.has("l");

  // Build the smallest MODE command that moves the channel from its current modes to the chosen ones.
  const plus: string[] = [];
  const minus: string[] = [];
  const plusParams: string[] = [];
  const minusParams: string[] = [];

  for (const f of SWITCH_FLAGS) {
    const on = wanted.has(f);
    const was = current.has(f);
    if (on && !was) plus.push(f);
    if (!on && was) minus.push(f);
  }
  if (keyOn && !keyWasSet && keyValue.trim()) {
    plus.push("k");
    plusParams.push(keyValue.trim());
  }
  if (!keyOn && keyWasSet && keyValue.trim()) {
    minus.push("k");
    minusParams.push(keyValue.trim());
  }
  if (limitOn && /^\d+$/.test(limitValue.trim())) {
    plus.push("l");
    plusParams.push(limitValue.trim());
  }
  if (!limitOn && limitWasSet) {
    minus.push("l");
  }

  const modeString = (plus.length ? `+${plus.join("")}` : "") + (minus.length ? `-${minus.join("")}` : "");
  const params = [...plusParams, ...minusParams];
  const commandText = modeString ? ["/mode", channelName, modeString, ...params].join(" ") : "";

  // Removing a key needs the current key, which the server does not tell us.
  const keyRemovalBlocked = !keyOn && keyWasSet && !keyValue.trim();
  const limitBlocked = limitOn && !/^\d+$/.test(limitValue.trim()) && !limitWasSet;
  const canSend = canAct && !!commandText && !keyRemovalBlocked && !limitBlocked;

  const toggle = (f: string) =>
    setWanted((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });

  return (
    <div className="p-3 space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {SWITCH_FLAGS.map((f) => (
          <button
            key={f}
            type="button"
            disabled={!canAct}
            onClick={() => toggle(f)}
            className={cn(
              "flex items-center gap-x-2 rounded-md border px-2 py-1.5 text-left text-xs transition",
              wanted.has(f)
                ? "border-indigo-500 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200"
                : "border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300",
              !canAct && "opacity-50 cursor-not-allowed"
            )}
          >
            <span className="font-mono font-semibold">+{f}</span>
            <span className="truncate text-zinc-500 dark:text-zinc-400">{t(`chat.modes.${f}`)}</span>
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-x-2">
          <input
            type="checkbox"
            disabled={!canAct}
            checked={keyOn}
            onChange={(e) => setKeyOn(e.target.checked)}
            className="accent-indigo-500"
          />
          <span className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-200">+k</span>
          <Input
            disabled={!canAct}
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            placeholder={t("cp.keyLabel")}
            className="h-7 text-xs"
          />
        </div>
        <div className="flex items-center gap-x-2">
          <input
            type="checkbox"
            disabled={!canAct}
            checked={limitOn}
            onChange={(e) => setLimitOn(e.target.checked)}
            className="accent-indigo-500"
          />
          <span className="text-xs font-mono font-semibold text-zinc-700 dark:text-zinc-200">+l</span>
          <Input
            disabled={!canAct}
            value={limitValue}
            onChange={(e) => setLimitValue(e.target.value)}
            placeholder={t("cp.limitLabel")}
            inputMode="numeric"
            className="h-7 text-xs"
          />
        </div>
        {keyRemovalBlocked && <p className="text-[11px] text-amber-600 dark:text-amber-400">{t("cp.keyNeeded")}</p>}
      </div>

      <div className="rounded-md bg-zinc-100 dark:bg-[#1e1f22] px-2 py-1.5">
        <div className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400">{t("cp.preview")}</div>
        <code className="text-xs font-mono text-zinc-800 dark:text-zinc-100 break-all">
          {commandText || t("cp.noChanges")}
        </code>
      </div>

      <div className="flex justify-end gap-x-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {t("cp.close")}
        </Button>
        <Button type="button" size="sm" disabled={!canSend} onClick={() => onSend(commandText)}>
          {t("cp.send")}
        </Button>
      </div>
    </div>
  );
};

const MemberPanel = ({
  command,
  channelName,
  channelMembers,
  userModes,
  channelOps,
  serverMembers,
  ourNick,
  canAct,
  onSend,
}: {
  command: Exclude<PanelCommand, "mode" | "away" | "join">;
  channelName: string;
  channelMembers: string[];
  userModes: Record<string, string[]>;
  channelOps: string[];
  serverMembers: string[];
  ourNick: string;
  canAct: boolean;
  onSend: (text: string) => void;
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");

  const isOpNick = (nick: string) =>
    channelOps.some((o) => o.toLowerCase() === nick.toLowerCase()) ||
    isOperatorModes(userModes[nick.toLowerCase()] ?? EMPTY);
  const isVoiceNick = (nick: string) => (userModes[nick.toLowerCase()] ?? EMPTY).some((m) => m.toLowerCase() === "v");
  const onChannel = (nick: string) => channelMembers.some((m) => m.toLowerCase() === nick.toLowerCase());

  // Only show people for whom the action makes sense.
  const eligible = (() => {
    switch (command) {
      case "op":
        return channelMembers.filter((nick) => !isOpNick(nick));
      case "deop":
        return channelMembers.filter((nick) => isOpNick(nick));
      case "voice":
        return channelMembers.filter((nick) => !isVoiceNick(nick));
      case "devoice":
        return channelMembers.filter((nick) => isVoiceNick(nick));
      case "invite":
        // Server members who are not on this channel yet.
        return serverMembers.filter((nick) => !onChannel(nick));
      case "query":
        return serverMembers;
    }
  })().filter((nick) => isNick(nick) && nick.toLowerCase() !== ourNick);

  const q = search.trim().toLowerCase();
  const shown = [...new Set(eligible)]
    .filter((nick) => !q || nick.toLowerCase().includes(q))
    .sort((a, b) => a.localeCompare(b));

  const buildCommand = (nick: string) => {
    if (command === "query") return `/query ${nick}`;
    if (command === "invite") return `/invite ${nick} ${channelName}`;
    return `/${command} ${channelName} ${nick}`;
  };

  const badge = command === "op" || command === "deop" ? "@" : command === "voice" || command === "devoice" ? "+" : "";

  return (
    <div className="p-3 space-y-2">
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("cp.searchMembers")}
        className="h-7 text-xs"
        disabled={!canAct}
      />
      <div className="max-h-60 overflow-y-auto space-y-0.5">
        {shown.length === 0 ? (
          <p className="py-4 text-center text-xs text-zinc-500 dark:text-zinc-400">{t("cp.noMembers")}</p>
        ) : (
          shown.map((nick) => (
            <button
              key={nick}
              type="button"
              disabled={!canAct}
              onClick={() => onSend(buildCommand(nick))}
              className={cn(
                "w-full flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition",
                canAct
                  ? "hover:bg-zinc-100 dark:hover:bg-zinc-700/50 text-zinc-800 dark:text-zinc-100 cursor-pointer"
                  : "opacity-50 cursor-not-allowed text-zinc-500"
              )}
            >
              <span className="truncate">{nick}</span>
              {badge && <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400">{badge}</span>}
            </button>
          ))
        )}
      </div>
    </div>
  );
};
