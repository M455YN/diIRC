import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ask } from "@tauri-apps/plugin-dialog";
import { Download, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useMockStore } from "@/lib/mock-store";
import { isTauriEnvironment } from "@/lib/update-service";
import { useExtensionStore } from "@/hooks/use-extension-store";
import { refreshExtensions } from "@/lib/extensions/host";
import { applyImport, buildExport, installImportedExtensions, pickImportFile, resetEverything, saveExport } from "@/lib/settings-transfer";

export const SettingsTransferSection = () => {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState(true);
  const [servers, setServers] = useState(true);
  const [includePasswords, setIncludePasswords] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const allServers = useMockStore((state) => state.servers);
  const [skipServers, setSkipServers] = useState<ReadonlySet<string>>(new Set());
  const [skipChannels, setSkipChannels] = useState<ReadonlySet<string>>(new Set());

  const toggle = (set: ReadonlySet<string>, id: string, on: boolean) => {
    const next = new Set(set);
    if (on) next.delete(id);
    else next.add(id);
    return next;
  };

  const installedExtensions = useExtensionStore((state) => state.installed);
  const [pickedExtensions, setPickedExtensions] = useState<ReadonlySet<string>>(new Set());
  const [withExtensions, setWithExtensions] = useState(true);
  const native = isTauriEnvironment();

  useEffect(() => {
    if (native) void refreshExtensions();
  }, [native]);

  const noServerPicked = servers && allServers.every((sv) => skipServers.has(sv.id));
  const noExtensions = !native || !withExtensions || pickedExtensions.size === 0;
  const noneSelected = !settings && (!servers || noServerPicked) && noExtensions;

  const run = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch (e) {
      setStatus({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleExport = () =>
    run(async () => {
      const json = await buildExport({
        settings,
        servers,
        includePasswords,
        skipServers,
        skipChannels,
        extensions: native && withExtensions ? pickedExtensions : undefined,
      });
      if (await saveExport(json, includePasswords)) {
        setStatus({ ok: true, text: t("settings.transfer.exported") });
      }
    });

  const importText = async (text: string) => {
    const summary = applyImport(text, { settings, servers, extensions: native && withExtensions });
    const extensions = await installImportedExtensions(summary.extensions);
    setStatus({
      ok: true,
      text: t("settings.transfer.imported", { added: summary.added, skipped: summary.skipped, extensions }),
    });
    if (summary.settings) setTimeout(() => window.location.reload(), 1500);
  };

  const handleImport = () =>
    isTauriEnvironment()
      ? run(async () => {
          const text = await pickImportFile();
          if (text !== null) await importText(text);
        })
      : fileRef.current?.click();

  const handleFile = (file: File | undefined) =>
    run(async () => {
      if (file) await importText(await file.text());
      if (fileRef.current) fileRef.current.value = "";
    });

  const handleReset = () =>
    run(async () => {
      const message = t("settings.transfer.resetConfirm");
      const confirmed = native ? await ask(message, { kind: "warning" }) : window.confirm(message);
      if (confirmed) await resetEverything();
    });

  const row = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <label className="flex items-center justify-between gap-x-3 text-sm text-zinc-900 dark:text-zinc-100">
      {label}
      <Switch checked={checked} onCheckedChange={onChange} />
    </label>
  );

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 shadow-sm space-y-3">
      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{t("settings.transfer.description")}</p>
      {row(t("settings.transfer.settings"), settings, setSettings)}
      {row(t("settings.transfer.servers"), servers, setServers)}
      {servers && allServers.length > 0 && (
        <div className="max-h-56 overflow-y-auto rounded-lg border border-zinc-200 dark:border-zinc-700/60 p-2 space-y-1">
          {allServers.map((sv) => {
            const serverOn = !skipServers.has(sv.id);
            return (
              <div key={sv.id}>
                <label className="flex items-center gap-x-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <input
                    type="checkbox"
                    checked={serverOn}
                    onChange={(e) => setSkipServers(toggle(skipServers, sv.id, e.target.checked))}
                  />
                  {sv.name}
                </label>
                {serverOn &&
                  sv.channels
                    .filter((c) => !c.isTemporary)
                    .map((c) => (
                      <label key={c.id} className="ml-6 flex items-center gap-x-2 text-xs text-zinc-700 dark:text-zinc-300">
                        <input
                          type="checkbox"
                          checked={!skipChannels.has(c.id)}
                          onChange={(e) => setSkipChannels(toggle(skipChannels, c.id, e.target.checked))}
                        />
                        {c.name}
                      </label>
                    ))}
              </div>
            );
          })}
        </div>
      )}
      {native && row(t("settings.transfer.extensions"), withExtensions, setWithExtensions)}
      {native && withExtensions && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700/60 p-2 space-y-1">
          {installedExtensions.length === 0 && (
            <p className="text-xs text-zinc-500">{t("settings.transfer.noExtensions")}</p>
          )}
          {installedExtensions.map((ext) => (
            <label key={ext.id} className="flex items-center gap-x-2 text-sm text-zinc-900 dark:text-zinc-100">
              <input
                type="checkbox"
                checked={pickedExtensions.has(ext.id)}
                onChange={(e) => {
                  const next = new Set(pickedExtensions);
                  if (e.target.checked) next.add(ext.id);
                  else next.delete(ext.id);
                  setPickedExtensions(next);
                }}
              />
              {ext.name}
            </label>
          ))}
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t("settings.transfer.extensionsNote")}</p>
        </div>
      )}
      {row(t("settings.transfer.passwords"), includePasswords, setIncludePasswords)}
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        {includePasswords ? t("settings.transfer.passwordsWarning") : t("settings.transfer.passwordsOff")}
      </p>
      <div className="flex gap-x-2 pt-1">
        <Button size="sm" disabled={noneSelected} onClick={handleExport} className="text-xs font-semibold gap-x-1.5">
          <Download className="w-3.5 h-3.5" />
          {t("settings.transfer.export")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={noneSelected}
          onClick={handleImport}
          className="text-xs font-semibold gap-x-1.5"
        >
          <Upload className="w-3.5 h-3.5" />
          {t("settings.transfer.import")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      <div className="border-t border-zinc-200 dark:border-zinc-700/60 pt-3 space-y-2">
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{t("settings.transfer.resetDescription")}</p>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReset}
          className="text-xs font-semibold gap-x-1.5 text-rose-600 border-rose-300 hover:bg-rose-50 dark:text-rose-400 dark:border-rose-900 dark:hover:bg-rose-950"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          {t("settings.transfer.reset")}
        </Button>
      </div>
      {status && (
        <p className={`text-xs ${status.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"}`}>{status.text}</p>
      )}
    </div>
  );
};
