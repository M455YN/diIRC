import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import { Copy, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useModal } from "@/hooks/use-modal-store";
import { copyToClipboard } from "@/lib/system-utils";

interface RawLine {
  time: string;
  dir: "rx" | "tx";
  line: string;
}

const REFRESH_MS = 1000;

/** The last IRC lines of a server, sent (tx) and received (rx); passwords are hidden by the backend. */
export const RawLogModal = () => {
  const { t } = useTranslation();
  const { isOpen, onClose, type, data } = useModal();
  const isModalOpen = isOpen && type === "rawLog";
  const serverId = data.serverId;
  const [lines, setLines] = useState<RawLine[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);

  useEffect(() => {
    if (!isModalOpen || !serverId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const next = await invoke<RawLine[]>("get_raw_log", { serverId });
        if (!cancelled) setLines(next ?? []);
      } catch {
        // Not running inside the app: nothing to show.
      }
    };
    void load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [isModalOpen, serverId]);

  useEffect(() => {
    const list = listRef.current;
    if (list && stickRef.current) list.scrollTop = list.scrollHeight;
  }, [lines]);

  const format = (line: RawLine) => `${line.time} ${line.dir === "tx" ? ">>" : "<<"} ${line.line}`;

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-4xl bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800">
        <DialogHeader>
          <DialogTitle>{t("rawLog.title")}</DialogTitle>
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">{t("rawLog.desc")}</DialogDescription>
        </DialogHeader>
        <div
          ref={listRef}
          onScroll={(e) => {
            const el = e.currentTarget;
            stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
          }}
          className="h-[55vh] overflow-auto rounded-md bg-zinc-950 p-2 font-mono text-[11px] leading-5"
        >
          {lines.length === 0 ? (
            <p className="p-4 text-center text-zinc-500">{t("rawLog.empty")}</p>
          ) : (
            lines.map((line, index) => (
              <div key={index} className={line.dir === "tx" ? "text-sky-300" : "text-emerald-300"}>
                <span className="text-zinc-500">{line.time}</span> {line.dir === "tx" ? ">>" : "<<"}{" "}
                <span className="whitespace-pre-wrap break-all">{line.line}</span>
              </div>
            ))
          )}
        </div>
        <div className="flex items-center justify-between gap-x-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{t("rawLog.note")}</span>
          <div className="flex gap-x-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void copyToClipboard(lines.map(format).join("\n"))}>
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              {t("rawLog.copy")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (serverId) void invoke("clear_raw_log", { serverId });
                setLines([]);
              }}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              {t("rawLog.clear")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
