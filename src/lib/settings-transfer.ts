import { v4 as uuidv4 } from "uuid";
import { useMockStore } from "@/lib/mock-store";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { isTauriEnvironment } from "@/lib/update-service";
import { invoke } from "@tauri-apps/api/core";
import { useExtensionStore } from "@/hooks/use-extension-store";
import { installExtensionSource, setExtensionEnabled } from "@/lib/extensions/host";
import type { Server } from "@/types";

const FORMAT = "luna-irc-export";
const VERSION = 1;

/** Small persisted stores / keys outside the main store that hold user preferences. */
const EXTRA_STORAGE_KEYS = ["app-language", "diirc-appearance-style", "diirc-mobile-theme", "theme"];

/** Main-store keys that are per-machine runtime or per-server data and never travel in the settings block. */
const SETTINGS_EXCLUDED = new Set([
  "servers",
  "currentProfile",
  "manuallyDisconnectedServers",
  "lastActiveChatPerServer",
  "serverMotds",
  "serverMotdSeenHashes",
  "dmLastActivity",
  // Personal lists: who the user ignores and which words they get notified about.
  "ignoredUsers",
  "highlightWords",
  // Live state: pending invites name other people, a pending join may carry a channel key.
  "pendingInvites",
  "pendingJoin",
  // Private chats: which ones are open or were open, and their per-conversation notification overrides.
  "activeConversations",
  "historicalConversations",
  "conversationNotificationSettings",
]);

/** Settings maps keyed by server id; only entries of newly imported servers are applied. */
const PER_SERVER_MAPS = ["serverMotdPolicies", "serverMediaCollapsePolicies"];

/** On-connect lines that most likely carry a secret (`/msg NickServ IDENTIFY ...`, `/oper`, ...). */
const SECRET_COMMAND = /identify|\bauth|\boper\b|pass|\blogin\b|\bsasl\b/i;

type Json = Record<string, any>;

export interface TransferOptions {
  settings: boolean;
  servers: boolean;
  includePasswords: boolean;
  /** Servers / channels (by id) left out of the export; everything else is included. */
  skipServers?: ReadonlySet<string>;
  skipChannels?: ReadonlySet<string>;
  /** Ids of installed extensions to export together with their code. */
  extensions?: ReadonlySet<string>;
}

interface ExportedExtension {
  id: string;
  source: string;
  enabled: boolean;
  settings: Record<string, string | boolean>;
}

export interface ImportSummary {
  settings: boolean;
  /** Extensions found in the file; install them with `installImportedExtensions`. */
  extensions: ExportedExtension[];
  added: number;
  skipped: number;
}

function exportServer(s: Server, includePasswords: boolean, skipChannels?: ReadonlySet<string>): Json {
  const { members: _members, channels, password, onConnectCommands, motd: _motd, currentNick: _nick, inviteCode: _invite, ...rest } = s;
  const out: Json = {
    ...rest,
    channels: channels
      .filter((c) => !c.isTemporary && !skipChannels?.has(c.id))
      .map((c) => ({ name: c.name, type: c.type, ...(includePasswords && c.key ? { key: c.key } : {}) })),
  };
  if (includePasswords) {
    if (password) out.password = password;
    if (onConnectCommands) out.onConnectCommands = onConnectCommands;
  } else if (onConnectCommands) {
    out.onConnectCommands = onConnectCommands.filter((l) => !SECRET_COMMAND.test(l));
  }
  return out;
}

export async function buildExport({ settings, servers, includePasswords, skipServers, skipChannels, extensions }: TransferOptions): Promise<string> {
  const state = useMockStore.getState();
  const data: Json = { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), includesPasswords: includePasswords };

  if (settings) {
    const persisted = useMockStore.persist.getOptions().partialize?.(state) ?? state;
    const block: Json = {};
    for (const [key, value] of Object.entries(persisted)) {
      if (SETTINGS_EXCLUDED.has(key) || typeof value === "function") continue;
      block[key] = value;
    }
    if (!includePasswords && Array.isArray(block.urlAuthRules)) {
      block.urlAuthRules = block.urlAuthRules.map((r: any) => ({ ...r, headerValue: "" }));
    }
    const extra: Json = {};
    for (const key of EXTRA_STORAGE_KEYS) {
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) extra[key] = raw;
      } catch {
        /* storage unavailable */
      }
    }
    data.settings = block;
    data.extraStorage = extra;
  }

  if (servers) {
    data.servers = state.servers
      .filter((s) => !skipServers?.has(s.id))
      .map((s) => exportServer(s, includePasswords, skipChannels));
    if (settings) {
      data.serverMaps = Object.fromEntries(PER_SERVER_MAPS.map((k) => [k, (state as any)[k] ?? {}]));
    }
  }

  if (extensions?.size) {
    const states = useExtensionStore.getState().extensions;
    data.extensions = [];
    for (const id of extensions) {
      const source = await invoke<string>("ext_read_source", { id });
      // Text settings may hold tokens, so they follow the password switch; pinned certificates never travel.
      const values = Object.entries(states[id]?.settings ?? {}).filter(([, v]) => includePasswords || typeof v === "boolean");
      data.extensions.push({ id, source, enabled: states[id]?.enabled ?? false, settings: Object.fromEntries(values) });
    }
  }

  return JSON.stringify(data, null, 2);
}

/** Saves the export through the native save dialog (browser download outside Tauri). Returns false when cancelled. */
export async function saveExport(json: string, includePasswords: boolean): Promise<boolean> {
  const fileName = `luna-irc-${includePasswords ? "full" : "no-passwords"}-${new Date().toISOString().slice(0, 10)}.json`;
  if (isTauriEnvironment()) {
    const path = await save({ defaultPath: fileName, filters: [{ name: "JSON", extensions: ["json"] }] });
    if (!path) return false;
    await writeTextFile(path, json);
    return true;
  }
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/** Picks an export file with the native open dialog and returns its text, or null when cancelled. Tauri only. */
export async function pickImportFile(): Promise<string | null> {
  const path = await open({ multiple: false, filters: [{ name: "JSON", extensions: ["json"] }] });
  return typeof path === "string" ? readTextFile(path) : null;
}

/** Parses and applies an export file. Throws an Error with a user-readable message when the file is not valid. */
export function applyImport(
  text: string,
  { settings, servers, extensions }: { settings: boolean; servers: boolean; extensions: boolean },
): ImportSummary {
  let data: Json;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  if (!data || data.format !== FORMAT) throw new Error("This is not a Luna IRC export file.");

  const store = useMockStore.getState();
  const summary: ImportSummary = { settings: false, extensions: [], added: 0, skipped: 0 };
  if (extensions && Array.isArray(data.extensions)) {
    summary.extensions = data.extensions.filter((e: any) => e && typeof e.id === "string" && typeof e.source === "string");
  }
  const newServerIds = new Set<string>();

  if (servers && Array.isArray(data.servers)) {
    const taken = new Set(store.servers.map((s) => s.id));
    const sameServer = (a: Server, b: Json) => a.host === b.host && a.port === b.port && a.name === b.name;
    const fresh: Server[] = [];
    for (const raw of data.servers as Json[]) {
      if (!raw || typeof raw.name !== "string" || typeof raw.host !== "string") continue;
      if (store.servers.some((s) => sameServer(s, raw))) {
        summary.skipped++;
        continue;
      }
      const id = typeof raw.id === "string" && !taken.has(raw.id) ? raw.id : `server-${uuidv4().slice(0, 8)}`;
      taken.add(id);
      newServerIds.add(id);
      const memberId = `member-${uuidv4().slice(0, 8)}`;
      const nicks: string[] = Array.isArray(raw.nicknames) && raw.nicknames.length ? raw.nicknames : ["ReactUser"];
      fresh.push({
        ...raw,
        id,
        profileId: store.currentProfile.id,
        inviteCode: `invite-${uuidv4().slice(0, 8)}`,
        port: raw.port || 6667,
        nicknames: nicks,
        channels: (Array.isArray(raw.channels) ? raw.channels : [])
          .filter((c: any) => c && typeof c.name === "string")
          .map((c: any) => ({
            id: `channel-${uuidv4().slice(0, 8)}`,
            name: c.name,
            type: c.type ?? "TEXT",
            key: c.key,
            profileId: store.currentProfile.id,
            serverId: id,
          })),
        members: [
          {
            id: memberId,
            profileId: store.currentProfile.id,
            profile: { ...store.currentProfile, name: nicks[0] },
            serverId: id,
          },
        ],
      } as Server);
    }
    if (fresh.length) {
      useMockStore.setState((state) => ({
        servers: [...state.servers, ...fresh],
        manuallyDisconnectedServers: {
          ...state.manuallyDisconnectedServers,
          ...Object.fromEntries(fresh.filter((s) => s.autoConnect === false).map((s) => [s.id, true])),
        },
      }));
    }
    summary.added = fresh.length;
  }

  if (settings && data.settings && typeof data.settings === "object") {
    const patch: Json = {};
    for (const [key, value] of Object.entries(data.settings as Json)) {
      if (SETTINGS_EXCLUDED.has(key) || PER_SERVER_MAPS.includes(key)) continue;
      if (!(key in store) || typeof (store as any)[key] === "function") continue;
      patch[key] = value;
    }
    for (const key of PER_SERVER_MAPS) {
      const incoming = data.serverMaps?.[key] ?? data.settings[key];
      if (!incoming || typeof incoming !== "object") continue;
      const entries = Object.entries(incoming).filter(([id]) => newServerIds.has(id));
      if (entries.length) patch[key] = { ...(store as any)[key], ...Object.fromEntries(entries) };
    }
    useMockStore.setState(patch);

    if (data.extraStorage && typeof data.extraStorage === "object") {
      for (const key of EXTRA_STORAGE_KEYS) {
        const raw = data.extraStorage[key];
        if (typeof raw !== "string") continue;
        try {
          localStorage.setItem(key, raw);
        } catch {
          /* storage unavailable */
        }
      }
    }
    summary.settings = true;
  }

  return summary;
}

/** Installs extensions from an export. Each one shows its permission prompt, so the user can decline it. */
export async function installImportedExtensions(list: ExportedExtension[]): Promise<number> {
  let installed = 0;
  for (const entry of list) {
    const manifest = await installExtensionSource(entry.source);
    if (!manifest) continue;
    installed++;
    const store = useExtensionStore.getState();
    for (const spec of manifest.settings) {
      const value = entry.settings?.[spec.key];
      if (typeof value === "string" || typeof value === "boolean") store.setSetting(manifest.id, spec.key, value);
    }
    if (!entry.enabled) setExtensionEnabled(manifest, false);
  }
  return installed;
}

/**
 * Factory reset: settings, servers, channels, installed extensions and every other locally stored preference,
 * so the app starts like a fresh install. Persistence of the main store is switched off first so a late
 * store update cannot write the old state back before the reload. Chat logs on disk are not touched.
 */
export async function resetEverything() {
  useMockStore.persist.setOptions({ storage: undefined });
  if (isTauriEnvironment()) {
    const installed = await invoke<{ id: string }[]>("ext_list").catch(() => []);
    await Promise.all(installed.map((e) => invoke("ext_remove", { id: e.id }).catch(() => undefined)));
  }
  localStorage.clear();
  window.location.reload();
}
