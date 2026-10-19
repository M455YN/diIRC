import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ask, open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { settingsOf, useExtensionStore } from "@/hooks/use-extension-store";
import { installExtensionFile, refreshExtensions, removeExtension, setExtensionEnabled } from "@/lib/extensions/host";

const supported = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const card = "rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 shadow-sm space-y-3";

/** Luna features → Extensions: install from a file, turn on and off, set up and remove. */
export const ExtensionsSettings = () => {
  const { t } = useTranslation();
  const installed = useExtensionStore((state) => state.installed);
  const states = useExtensionStore((state) => state.extensions);
  const setSetting = useExtensionStore((state) => state.setSetting);
  const forgetCertificate = useExtensionStore((state) => state.forgetCertificate);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (supported) void refreshExtensions();
  }, []);

  const add = async () => {
    setError(null);
    try {
      const path = await openFileDialog({ multiple: false, filters: [{ name: "Luna extension", extensions: ["js"] }] });
      if (typeof path === "string") await installExtensionFile(path);
    } catch (failure) {
      setError(t("extensions.installFailed", { error: String(failure) }));
    }
  };

  const remove = async (id: string, name: string) => {
    if (await ask(t("extensions.removeConfirm", { name }), { kind: "warning" })) await removeExtension(id);
  };

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{t("extensions.intro")}</p>
      {!supported ? (
        <p className="text-sm text-zinc-500">{t("extensions.unsupported")}</p>
      ) : (
        <>
          <div className="space-y-2">
            <Button type="button" size="sm" onClick={() => void add()}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t("extensions.add")}
            </Button>
            <p className="text-xs text-amber-600 dark:text-amber-400">{t("extensions.warning")}</p>
            {error && <p className="break-words text-xs text-rose-500">{error}</p>}
          </div>

          {installed.length === 0 && <p className="py-4 text-center text-sm text-zinc-500">{t("extensions.empty")}</p>}

          {installed.map((manifest) => {
            const state = states[manifest.id];
            const values = settingsOf(manifest);
            const hosts = manifest.permissions.network;
            return (
              <div key={manifest.id} className={card}>
                <div className="flex items-start justify-between gap-x-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      {manifest.name} <span className="font-mono text-xs font-normal text-zinc-500">v{manifest.version}</span>
                    </p>
                    {manifest.author && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("extensions.by", { author: manifest.author })}</p>
                    )}
                    {manifest.description && (
                      <p className="mt-1 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">{manifest.description}</p>
                    )}
                    <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                      {hosts.length ? t("extensions.network", { hosts: hosts.join(", ") }) : t("extensions.noNetwork")}
                    </p>
                  </div>
                  <Switch checked={Boolean(state?.enabled)} onCheckedChange={(on) => setExtensionEnabled(manifest, on)} />
                </div>

                {manifest.settings.map((setting) =>
                  setting.type === "boolean" ? (
                    <div key={setting.key} className="flex items-center justify-between gap-x-3 text-sm text-zinc-800 dark:text-zinc-200">
                      <span>{setting.label}</span>
                      <Switch checked={values[setting.key] === true} onCheckedChange={(on) => setSetting(manifest.id, setting.key, on)} />
                    </div>
                  ) : (
                    <div key={setting.key} className="space-y-1">
                      <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{setting.label}</label>
                      <Input
                        value={String(values[setting.key] ?? "")}
                        placeholder={setting.placeholder}
                        onChange={(event) => setSetting(manifest.id, setting.key, event.target.value)}
                        className="h-9 bg-white text-sm dark:bg-[#1e1f22]"
                      />
                    </div>
                  )
                )}

                {Object.keys(state?.pins ?? {}).length > 0 && (
                  <div className="space-y-1 border-t border-zinc-200 pt-2 dark:border-zinc-700/60">
                    <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">{t("extensions.trustedCerts")}</p>
                    {Object.entries(state?.pins ?? {}).map(([host, sha]) => (
                      <div key={host} className="flex items-center justify-between gap-x-3 text-xs text-zinc-600 dark:text-zinc-300">
                        <span className="truncate font-mono">
                          {host} · {sha.slice(0, 16)}…
                        </span>
                        <button
                          type="button"
                          className="shrink-0 text-indigo-500 hover:underline"
                          onClick={() => forgetCertificate(manifest.id, host)}
                        >
                          {t("extensions.forgetCert")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-rose-500 hover:bg-rose-500/10"
                    onClick={() => void remove(manifest.id, manifest.name)}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    {t("extensions.remove")}
                  </Button>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};
