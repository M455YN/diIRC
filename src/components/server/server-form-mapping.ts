import type { Server, ServerReplyMode } from "@/types";
import type { UpdateServerOptions } from "@/lib/mock-store";
import { toFormSteps, type FormCommandRow } from "@/lib/commands/custom-command-steps";
import { normalizeCustomCommandsFromForm } from "@/components/server/custom-commands-fields";

/** Form values both server forms (desktop and mobile) keep in the same shape; without a server they are the defaults. */
export function serverToSharedForm(server?: Server) {
  return {
    username: server?.username || "",
    realname: server?.realname || "",
    password: server?.password || "",
    autoConnect: server?.autoConnect ?? true,
    autoReconnect: server?.autoReconnect ?? true,
    parseLegacyZncTimestamps: server?.parseLegacyZncTimestamps ?? false,
    onConnectCommands: (server?.onConnectCommands || []).join("\n"),
    replyMode: (server?.replyMode ?? "inherit") as ServerReplyMode,
    customCommands: (server?.customCommands || []).map(
      (c): FormCommandRow => ({
        trigger: c.trigger,
        description: c.description || "",
        suggestions: (c.suggestions || []).join(", "),
        steps: toFormSteps(c),
      })
    ),
  };
}

/** Inverse of `serverToSharedForm`: the part of the server options both forms save the same way. */
export function sharedFormToOptions(
  form: ReturnType<typeof serverToSharedForm>
): Pick<
  UpdateServerOptions,
  | "username"
  | "realname"
  | "password"
  | "autoConnect"
  | "autoReconnect"
  | "parseLegacyZncTimestamps"
  | "onConnectCommands"
  | "replyMode"
  | "customCommands"
> {
  return {
    username: form.username,
    realname: form.realname,
    password: form.password,
    autoConnect: form.autoConnect,
    autoReconnect: form.autoReconnect,
    parseLegacyZncTimestamps: form.parseLegacyZncTimestamps,
    onConnectCommands: form.onConnectCommands
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
    replyMode: form.replyMode,
    customCommands: normalizeCustomCommandsFromForm(form.customCommands),
  };
}
