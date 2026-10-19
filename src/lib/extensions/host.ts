import { invoke } from "@tauri-apps/api/core";
import i18n from "@/lib/i18n";
import { commandRegistry } from "@/lib/commands/command-system";
import { useModal } from "@/hooks/use-modal-store";
import { settingsOf, useExtensionStore } from "@/hooks/use-extension-store";
import { cleanDialog, MAX_TEXT, text } from "./dialog";
import type { CommandContext } from "@/lib/commands/command-system";
import type { DialogResult, DialogSpec, ExtensionDialogData, ExtensionManifest } from "./types";

/*
 * Runs extensions. Each enabled extension lives in a hidden sandboxed iframe loaded from a loopback server
 * (src-tauri/src/extensions.rs), whose CSP header leaves it no network, no storage and no access to the app.
 * Its origin is remote for Tauri, so the extension cannot call the app's commands either.
 * It talks to us only through postMessage, and every call below is checked against its manifest and the
 * permissions the user approved. Nothing here trusts what the extension sends.
 */

interface Running {
  manifest: ExtensionManifest;
  iframe: HTMLIFrameElement;
  commands: Set<string>;
  /** The chat the user last ran one of its commands in: where a dialog's send button goes. */
  context: CommandContext | null;
  listener: (event: MessageEvent) => void;
}

const running = new Map<string, Running>();

const COMMAND_NAME = /^[a-z][a-z0-9_-]{0,19}$/;

// ---- dialogs ----

let dialogQueue: Promise<unknown> = Promise.resolve();

/** Shows a dialog drawn by the app. One at a time: a second extension waits for the first to be answered. */
export function showExtensionDialog(extensionName: string, spec: DialogSpec, send?: ExtensionDialogData["send"]): Promise<DialogResult> {
  const show = () =>
    new Promise<DialogResult>((resolve) => {
      const extDialog: ExtensionDialogData = {
        extensionName,
        spec,
        send,
        resolve: (result) => {
          unsubscribe();
          resolve(result);
        },
      };
      // Another modal replaced this one (or it was closed some other way): the extension still gets an answer.
      const unsubscribe = useModal.subscribe((state) => {
        if (state.data.extDialog !== extDialog) {
          unsubscribe();
          resolve({ button: "dismiss", values: {} });
        }
      });
      useModal.getState().onOpen("extensionDialog", { extDialog });
    });
  const answer = dialogQueue.then(show, show);
  dialogQueue = answer.catch(() => undefined);
  return answer;
}

// ---- sending to the chat ----

/** Sends one line to the chat a command was run in, as the user (same path as /code), and shows it there. */
async function sendToChat(ctx: CommandContext, line: string): Promise<void> {
  const message = line.replace(/\r?\n/g, "\u0085");
  const base = { serverId: ctx.serverId, message, replyToMsgid: null, replyNick: null, replyPreview: null, replyParentOffset: null };
  if (ctx.type === "channel" && ctx.channelId) {
    const channel = ctx.channelName.startsWith("#") ? ctx.channelName : `#${ctx.channelName}`;
    await invoke("send_message", { ...base, channel });
    ctx.addMessage(ctx.channelId, ctx.currentMember, line);
  } else if (ctx.type === "conversation" && ctx.conversationId) {
    await invoke("send_message", { ...base, channel: ctx.channelName });
    ctx.addDirectMessage(ctx.conversationId, ctx.currentMember, line);
  } else {
    throw new Error("No chat to send to");
  }
}

/** The dialog's own "send to this chat" button, or undefined when there is no chat or nothing to send. */
function sendButton(entry: Running, spec: DialogSpec): ExtensionDialogData["send"] {
  const ctx = entry.context;
  if (!ctx || !spec.sendText) return undefined;
  const line = spec.sendText;
  const label =
    ctx.type === "channel"
      ? i18n.t("extensions.sendToChannel", { name: ctx.channelName.startsWith("#") ? ctx.channelName : `#${ctx.channelName}` })
      : i18n.t("extensions.sendToConversation", { name: ctx.channelName });
  return { label, run: () => sendToChat(ctx, line) };
}

// ---- network ----

interface HttpResponse {
  status: number;
  headers: [string, string][];
  body: string;
}

async function httpRequest(manifest: ExtensionManifest, raw: unknown): Promise<HttpResponse> {
  const input = (raw ?? {}) as Record<string, unknown>;
  const url = text(input.url, 2000);
  const host = new URL(url).host.toLowerCase();
  const headers = (Array.isArray(input.headers) ? input.headers : []).slice(0, 20).map((pair) => {
    if (!Array.isArray(pair) || typeof pair[0] !== "string" || typeof pair[1] !== "string") throw new Error("Invalid header");
    return [pair[0], pair[1]] as [string, string];
  });
  const request = {
    url,
    method: typeof input.method === "string" ? input.method : null,
    headers,
    body: typeof input.body === "string" ? input.body.slice(0, 2 * MAX_TEXT) : null,
  };

  const state = useExtensionStore.getState().extensions[manifest.id];
  // Only hosts that are both declared by the extension and approved by the user.
  const allowedHosts = manifest.permissions.network.filter((entry) => state?.network.includes(entry));
  const attempt = (pin: string | null) =>
    invoke<HttpResponse>("ext_http", { request, allowedHosts, pinnedSha256: pin });

  try {
    return await attempt(state?.pins[host] ?? null);
  } catch (error) {
    const code = String(error);
    if (code === "cert_mismatch") throw new Error(i18n.t("extensions.certMismatch", { host }));
    if (code !== "cert_untrusted") throw new Error(code);

    // The system does not trust this server's certificate. Ask the user, in a dialog the extension cannot touch.
    const fingerprint = await invoke<string>("ext_probe_cert", { url, allowedHosts });
    const answer = await showExtensionDialog(manifest.name, {
      title: i18n.t("extensions.trustTitle"),
      text: i18n.t("extensions.trustText", { name: manifest.name, host, fingerprint }),
      fields: [],
      buttons: [
        { id: "cancel", label: i18n.t("extensions.cancel"), primary: false },
        { id: "trust", label: i18n.t("extensions.trust"), primary: true },
      ],
    });
    if (answer.button !== "trust") throw new Error(i18n.t("extensions.certDeclined", { host }));
    useExtensionStore.getState().pinCertificate(manifest.id, host, fingerprint);
    return attempt(fingerprint);
  }
}

// ---- the calls an extension can make ----

async function dispatch(entry: Running, method: string, params: unknown): Promise<unknown> {
  const { manifest } = entry;
  switch (method) {
    case "ready":
      return null;
    case "log":
      console.warn(`[extension ${manifest.id}]`, text((params as { text?: unknown })?.text, 500));
      return null;
    case "settings.get":
      return settingsOf(manifest);
    case "ui.dialog": {
      const spec = cleanDialog(params);
      return showExtensionDialog(manifest.name, spec, sendButton(entry, spec));
    }
    case "http.request":
      return httpRequest(manifest, params);
    case "commands.register": {
      const input = (params ?? {}) as { name?: unknown; description?: unknown };
      const name = text(input.name, 20).toLowerCase();
      if (!COMMAND_NAME.test(name)) throw new Error("Command names are lowercase letters, digits, - and _ (up to 20)");
      if (commandRegistry.get(name) && !entry.commands.has(name)) throw new Error(`/${name} already exists`);
      entry.commands.add(name);
      commandRegistry.register({
        name,
        description: text(input.description, 120) || manifest.name,
        execute: (args, ctx) => {
          entry.context = ctx;
          entry.iframe.contentWindow?.postMessage({ luna: 1, event: "command", name, args }, "*");
          return true;
        },
      });
      return null;
    }
    default:
      throw new Error(`Unknown call: ${method}`);
  }
}

async function handleMessage(entry: Running, data: unknown) {
  const message = data as { luna?: number; id?: unknown; method?: unknown; params?: unknown } | null;
  if (!message || message.luna !== 1 || typeof message.id !== "number" || typeof message.method !== "string") return;
  let reply: Record<string, unknown>;
  try {
    reply = { result: await dispatch(entry, message.method, message.params) };
  } catch (error) {
    reply = { error: error instanceof Error ? error.message : String(error) };
  }
  entry.iframe.contentWindow?.postMessage({ luna: 1, reply: true, id: message.id, ...reply }, "*");
}

// ---- lifecycle ----

let originPromise: Promise<string> | null = null;
const extensionOrigin = () => (originPromise ??= invoke<string>("ext_origin").catch((error) => {
  originPromise = null;
  throw error;
}));

export async function startExtension(manifest: ExtensionManifest) {
  if (running.has(manifest.id) || !useExtensionStore.getState().extensions[manifest.id]?.enabled) return;
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", "allow-scripts"); // no allow-same-origin: the document gets an opaque origin
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  iframe.style.display = "none";
  const entry: Running = { manifest, iframe, commands: new Set(), context: null, listener: () => undefined };
  entry.listener = (event) => {
    if (event.source === iframe.contentWindow) void handleMessage(entry, event.data);
  };
  window.addEventListener("message", entry.listener);
  running.set(manifest.id, entry);
  try {
    iframe.src = `${await extensionOrigin()}/${manifest.id}/index.html`;
  } catch (error) {
    stopExtension(manifest.id);
    throw error;
  }
  // Stopped (turned off, removed) while the server address was being fetched: do not bring it back.
  if (running.get(manifest.id) === entry) document.body.appendChild(iframe);
}

export function stopExtension(id: string) {
  const entry = running.get(id);
  if (!entry) return;
  window.removeEventListener("message", entry.listener);
  for (const name of entry.commands) commandRegistry.unregister(name);
  entry.iframe.remove();
  running.delete(id);
}

export const isRunning = (id: string) => running.has(id);

/** Reads the installed extensions and starts the enabled ones. A web build has none. */
export async function refreshExtensions(): Promise<ExtensionManifest[]> {
  const installed = await invoke<ExtensionManifest[]>("ext_list").catch(() => []);
  useExtensionStore.getState().setInstalled(installed);
  const ids = new Set(installed.map((manifest) => manifest.id));
  for (const id of [...running.keys()]) if (!ids.has(id)) stopExtension(id);
  await Promise.all(
    installed.map((manifest) =>
      startExtension(manifest).catch((error) => console.warn(`[extension ${manifest.id}] could not start:`, error))
    )
  );
  return installed;
}

export function setExtensionEnabled(manifest: ExtensionManifest, enabled: boolean) {
  useExtensionStore.getState().setEnabled(manifest.id, enabled);
  if (enabled) void startExtension(manifest);
  else stopExtension(manifest.id);
}

/** Asks the user to approve the file's permissions, then installs it. Resolves to the manifest, or null if declined. */
export async function installExtensionFile(path: string): Promise<ExtensionManifest | null> {
  const manifest = await invoke<ExtensionManifest>("ext_inspect", { path });
  const network = manifest.permissions.network;
  const answer = await showExtensionDialog(manifest.name, {
    title: i18n.t("extensions.installTitle", { name: manifest.name }),
    text: i18n.t("extensions.installText", {
      version: manifest.version,
      author: manifest.author ? ` · ${manifest.author}` : "",
      description: manifest.description,
      permissions: network.length ? i18n.t("extensions.network", { hosts: network.join(", ") }) : i18n.t("extensions.noNetwork"),
    }),
    fields: [],
    buttons: [
      { id: "cancel", label: i18n.t("extensions.cancel"), primary: false },
      { id: "install", label: i18n.t("extensions.install"), primary: true },
    ],
  });
  if (answer.button !== "install") return null;
  stopExtension(manifest.id);
  await invoke("ext_install", { path });
  useExtensionStore.getState().approve(manifest.id, network);
  await refreshExtensions();
  return manifest;
}

export async function removeExtension(id: string) {
  stopExtension(id);
  await invoke("ext_remove", { id });
  useExtensionStore.getState().forget(id);
  await refreshExtensions();
}
