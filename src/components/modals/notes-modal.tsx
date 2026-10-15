import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Bold,
  Code,
  Eye,
  Italic,
  List,
  ListOrdered,
  Pencil,
  Plus,
  Quote,
  Strikethrough,
  Trash2,
  Underline,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { useNotesStore } from "@/hooks/use-notes-store";
import { useIsMobileShell } from "@/hooks/use-mobile-platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/lib/markdown/markdown-renderer";
import {
  isMarkdownFormatActive,
  toggleLinePrefix,
  toggleMarkdownWrap,
  wrapCodeBlock,
} from "@/lib/markdown/markdown-utils";

const WRAP_FORMATS = [
  { id: "bold", icon: Bold, before: "**", after: "**", label: "chat.input.bold", key: "b", shift: false },
  { id: "italic", icon: Italic, before: "*", after: "*", label: "chat.input.italic", key: "i", shift: false },
  { id: "underline", icon: Underline, before: "__", after: "__", label: "chat.input.underline", key: "u", shift: false },
  { id: "strikethrough", icon: Strikethrough, before: "~~", after: "~~", label: "chat.input.strikethrough", key: "x", shift: true },
] as const;

const BLOCK_FORMATS = [
  { id: "code-block", icon: Code, label: "chat.input.codeBlock", apply: (el: HTMLTextAreaElement) => wrapCodeBlock(el) },
  { id: "quote", icon: Quote, label: "chat.input.quote", apply: (el: HTMLTextAreaElement) => toggleLinePrefix(el, "> ") },
  { id: "bullet-list", icon: List, label: "chat.input.bulletList", apply: (el: HTMLTextAreaElement) => toggleLinePrefix(el, "- ") },
  {
    id: "numbered-list",
    icon: ListOrdered,
    label: "chat.input.numberedList",
    apply: (el: HTMLTextAreaElement) => toggleLinePrefix(el, "", { numbered: true }),
  },
] as const;

/**
 * General private notes. Edits are saved as you type; nothing leaves this device.
 * Desktop shows the list and the editor side by side; on Android they are shown one at a time.
 */
export const NotesModal = () => {
  const { t } = useTranslation();
  const { isOpen, onClose, type } = useModal();
  const isModalOpen = isOpen && type === "notes";
  const isMobile = useIsMobileShell();

  const notes = useNotesStore((state) => state.notes);
  const add = useNotesStore((state) => state.add);
  const update = useNotesStore((state) => state.update);
  const remove = useNotesStore((state) => state.remove);

  const sorted = useMemo(() => [...notes].sort((a, b) => b.updatedAt - a.updatedAt), [notes]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);

  // Desktop: open on the newest note; if the selected one was deleted, fall back to the first remaining.
  // Phone: start on the list, so nothing is selected automatically.
  useEffect(() => {
    if (!isModalOpen || isMobile) return;
    if (!selectedId || !notes.some((n) => n.id === selectedId)) {
      setSelectedId(sorted[0]?.id ?? null);
    }
  }, [isModalOpen, isMobile, notes, selectedId, sorted]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  // Existing notes open in the preview; a note that was just created (or is still empty) opens in the editor.
  const createdIdRef = useRef<string | null>(null);
  useEffect(() => {
    const note = useNotesStore.getState().notes.find((n) => n.id === selectedId);
    const openInEditor = !note || selectedId === createdIdRef.current || !note.body.trim();
    setPreview(!openInEditor);
    setSelection({ start: 0, end: 0 });
  }, [selectedId]);

  const handleNew = () => {
    const id = add();
    createdIdRef.current = id;
    setSelectedId(id);
  };

  const handleDelete = () => {
    if (!selected) return;
    remove(selected.id);
    if (isMobile) setSelectedId(null);
  };

  const syncSelection = () => {
    const el = bodyRef.current;
    if (el) setSelection({ start: el.selectionStart, end: el.selectionEnd });
  };

  // Applies a formatting helper to the editor and stores the result as the note body.
  const applyTransform = useCallback(
    (
      transform: (el: HTMLTextAreaElement) => {
        newValue: string;
        newSelectionStart: number;
        newSelectionEnd: number;
      }
    ) => {
      const el = bodyRef.current;
      if (!el || !selected) return;
      const { newValue, newSelectionStart, newSelectionEnd } = transform(el);
      update(selected.id, { body: newValue });
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(newSelectionStart, newSelectionEnd);
        setSelection({ start: newSelectionStart, end: newSelectionEnd });
      }, 0);
    },
    [selected, update]
  );

  const handleBodyKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
    const format = WRAP_FORMATS.find((f) => f.key === e.key.toLowerCase() && f.shift === e.shiftKey);
    if (!format) return;
    e.preventDefault();
    applyTransform((el) => toggleMarkdownWrap(el, format.before, format.after));
  };

  const showList = !isMobile || !selected;
  const showEditor = !isMobile || !!selected;

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          "bg-white dark:bg-[#313338] text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800",
          isMobile
            ? "h-[100dvh] max-h-[100dvh] w-screen max-w-none rounded-none p-4"
            : "sm:max-w-3xl"
        )}
      >
        <DialogHeader>
          {isMobile && selected && showEditor ? (
            <div className="flex items-center gap-x-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedId(null)} aria-label={t("notes.back")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <DialogTitle className="text-zinc-900 dark:text-zinc-100">{t("notes.title")}</DialogTitle>
            </div>
          ) : (
            <DialogTitle className="text-zinc-900 dark:text-zinc-100">{t("notes.title")}</DialogTitle>
          )}
          <DialogDescription className="text-zinc-500 dark:text-zinc-400">{t("notes.desc")}</DialogDescription>
        </DialogHeader>

        <div className={cn("flex min-h-[320px] gap-x-3", isMobile ? "min-h-0 flex-1" : "h-[60vh]")}>
          {showList && (
            <div className={cn("flex shrink-0 flex-col gap-y-2", isMobile ? "w-full" : "w-56")}>
              <Button type="button" variant="secondary" size="sm" onClick={handleNew} className="bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600">
                <Plus className="mr-1.5 h-4 w-4" />
                {t("notes.new")}
              </Button>
              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                {sorted.length === 0 ? (
                  <p className="py-4 text-center text-xs text-zinc-500 dark:text-zinc-400">{t("notes.empty")}</p>
                ) : (
                  sorted.map((note) => (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => setSelectedId(note.id)}
                      className={cn(
                        "w-full rounded-md px-2 py-1.5 text-left text-sm transition",
                        note.id === selectedId
                          ? "bg-indigo-500/10 text-indigo-700 dark:text-indigo-200"
                          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700/40"
                      )}
                    >
                      <span className="block truncate font-medium">{note.title.trim() || t("notes.untitled")}</span>
                      <span className="block truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                        {note.body.trim().split("\n")[0] || " "}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {showEditor && (
            <div className="flex min-w-0 flex-1 flex-col gap-y-2">
              {selected ? (
                <>
                  <div className="flex items-center gap-x-2">
                  <Input
                    value={selected.title}
                    onChange={(e) => update(selected.id, { title: e.target.value })}
                    placeholder={t("notes.titlePlaceholder")}
                    className="h-9 font-semibold bg-white dark:bg-[#1e1f22] text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700"
                  />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setPreview((p) => !p)}
                      aria-label={preview ? t("notes.edit") : t("notes.preview")}
                      title={preview ? t("notes.edit") : t("notes.preview")}
                    >
                      {preview ? <Pencil className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  {!preview && (
                    <div className="flex flex-wrap items-center gap-0.5 rounded-md border border-zinc-300 px-1 py-0.5 dark:border-zinc-700">
                      {WRAP_FORMATS.map(({ id, icon: Icon, before, after, label }) => {
                        const active = isMarkdownFormatActive(selected.body, selection.start, selection.end, before, after);
                        return (
                          <Button
                            key={id}
                            type="button"
                            variant="ghost"
                            size="sm"
                            title={t(label)}
                            aria-label={t(label)}
                            aria-pressed={active}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => applyTransform((el) => toggleMarkdownWrap(el, before, after))}
                            className={cn("h-7 w-7 p-0", active && "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300")}
                          >
                            <Icon className="h-4 w-4" />
                          </Button>
                        );
                      })}
                      <span className="mx-1 h-4 w-px bg-zinc-300 dark:bg-zinc-700" />
                      {BLOCK_FORMATS.map(({ id, icon: Icon, label, apply }) => (
                        <Button
                          key={id}
                          type="button"
                          variant="ghost"
                          size="sm"
                          title={t(label)}
                          aria-label={t(label)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyTransform(apply)}
                          className="h-7 w-7 p-0"
                        >
                          <Icon className="h-4 w-4" />
                        </Button>
                      ))}
                    </div>
                  )}
                  {preview ? (
                    <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-zinc-300 p-3 dark:border-zinc-700">
                      {selected.body.trim() ? (
                        <MarkdownRenderer content={selected.body} allowImages={false} allowHtml keepMediaLinks />
                      ) : (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("notes.bodyPlaceholder")}</p>
                      )}
                    </div>
                  ) : (
                    <Textarea
                      ref={bodyRef}
                      value={selected.body}
                      onChange={(e) => update(selected.id, { body: e.target.value })}
                      onKeyDown={handleBodyKeyDown}
                      onSelect={syncSelection}
                      onKeyUp={syncSelection}
                      onClick={syncSelection}
                      placeholder={t("notes.bodyPlaceholder")}
                      className="min-h-0 flex-1 resize-none bg-white dark:bg-[#1e1f22] text-zinc-900 dark:text-zinc-100 border-zinc-300 dark:border-zinc-700"
                    />
                  )}
                  <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{t("notes.saved", { time: new Date(selected.updatedAt).toLocaleString() })}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleDelete}
                      className="text-rose-500 hover:text-rose-600"
                    >
                      <Trash2 className="mr-1.5 h-4 w-4" />
                      {t("notes.delete")}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-zinc-500 dark:text-zinc-400">
                  {t("notes.pickOrCreate")}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
