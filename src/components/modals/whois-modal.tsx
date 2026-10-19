import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";

interface WhoisEvent {
  serverId: string;
  nick: string;
  entries: [string, string][];
}

const TIMEOUT_MS = 8000;
/** Opening the window again for the same nick within this time shows the last answer instead of asking the server again. */
const CACHE_MS = 5000;
const recent = new Map<string, { at: number; result: WhoisEvent }>();

const duration = (seconds: number) => {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d && `${d}d`, (d || h) && `${h}h`, `${m}m`].filter(Boolean).join(" ");
};

/** What the server answered to a WHOIS for one nick. */
export const WhoisModal = () => {
  const { t } = useTranslation();
  const { isOpen, onClose, type, data } = useModal();
  const isModalOpen = isOpen && type === "whois";
  const { serverId, nick } = data;
  const [result, setResult] = useState<WhoisEvent | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!isModalOpen || !serverId || !nick) return;
    const cacheKey = `${serverId}|${nick.toLowerCase()}`;
    const cached = recent.get(cacheKey);
    if (cached && Date.now() - cached.at < CACHE_MS) {
      setResult(cached.result);
      setFailed(false);
      return;
    }
    setResult(null);
    setFailed(false);
    let unlisten: (() => void) | undefined;
    let cancelled = false;
    const timer = setTimeout(() => setFailed(true), TIMEOUT_MS);
    listen<WhoisEvent>("irc_whois", (event) => {
      const answer = event.payload;
      if (answer.serverId === serverId && answer.nick.toLowerCase() === nick.toLowerCase()) {
        clearTimeout(timer);
        recent.set(cacheKey, { at: Date.now(), result: answer });
        setResult(answer);
      }
    })
      .then((off) => {
        if (cancelled) return off();
        unlisten = off;
        return invoke("send_whois", { serverId, nick });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unlisten?.();
    };
  }, [isModalOpen, serverId, nick]);

  const value = (key: string, raw: string) => {
    const number = Number(raw);
    if (key === "idle" && Number.isFinite(number)) return duration(number);
    if (key === "signon" && Number.isFinite(number)) return new Date(number * 1000).toLocaleString();
    return raw;
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800">
        <DialogHeader>
          <DialogTitle>{t("whois.title", { nick })}</DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">{t("whois.desc")}</DialogDescription>
        </DialogHeader>
        {result ? (
          result.entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">{t("whois.notFound")}</p>
          ) : (
            <dl className="grid grid-cols-[8rem_1fr] gap-x-3 gap-y-1.5 text-sm">
              {result.entries.map(([key, raw], index) => (
                <div key={index} className="contents">
                  <dt className="text-zinc-500 dark:text-zinc-400">{t(`whois.keys.${key}`, { defaultValue: key })}</dt>
                  <dd className="break-words select-text">{value(key, raw) || "-"}</dd>
                </div>
              ))}
            </dl>
          )
        ) : (
          <p className="py-6 text-center text-sm text-zinc-500">{failed ? t("whois.noAnswer") : t("whois.loading")}</p>
        )}
      </DialogContent>
    </Dialog>
  );
};
