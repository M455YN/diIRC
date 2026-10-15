import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Eye, ImagePlus, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
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
import { useMockStore } from "@/lib/mock-store";
import { uploadImage } from "@/lib/upload/services";
import { MarkdownRenderer } from "@/lib/markdown/markdown-renderer";

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
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadConfig = useMockStore((state) => state.uploadConfig);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Desktop: open on the newest note; if the selected one was deleted, fall back to the first remaining.
  // Phone: start on the list, so nothing is selected automatically.
  useEffect(() => {
    if (!isModalOpen || isMobile) return;
    if (!selectedId || !notes.some((n) => n.id === selectedId)) {
      setSelectedId(sorted[0]?.id ?? null);
    }
  }, [isModalOpen, isMobile, notes, selectedId, sorted]);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  // A different note always opens in the editor.
  useEffect(() => {
    setPreview(false);
    setUploadError(null);
  }, [selectedId]);

  const handleNew = () => {
    const id = add();
    setSelectedId(id);
  };

  const handleDelete = () => {
    if (!selected) return;
    remove(selected.id);
    if (isMobile) setSelectedId(null);
  };

  // Same upload path as chat attachments: the configured provider returns a URL inserted as Markdown.
  const insertImages = useCallback(
    async (files: File[]) => {
      if (!selected) return;
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) return;
      if (uploadConfig.provider === "disabled") {
        setUploadError(t("chat.input.uploadDisabled"));
        return;
      }
      setUploadError(null);
      const noteId = selected.id;
      for (const file of images) {
        setUploading((n) => n + 1);
        try {
          const url = await uploadImage(file, uploadConfig);
          const alt = file.name.replace(/[\[\]]/g, "");
          const snippet = `![${alt}](${url})`;
          const state = useNotesStore.getState();
          const current = state.notes.find((n) => n.id === noteId);
          if (current) {
            const el = bodyRef.current;
            const pos = el && document.activeElement === el ? el.selectionStart : current.body.length;
            const before = current.body.slice(0, pos);
            const after = current.body.slice(pos);
            const lead = before && !before.endsWith("\n") ? "\n" : "";
            state.update(noteId, { body: `${before}${lead}${snippet}\n${after}` });
          }
        } catch (err: any) {
          setUploadError(err?.message || t("chat.input.uploadFailed"));
        } finally {
          setUploading((n) => n - 1);
        }
      }
    },
    [selected, uploadConfig, t]
  );

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    e.preventDefault();
    void insertImages(files);
  };

  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    e.preventDefault();
    void insertImages(files);
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
                      onClick={() => fileInputRef.current?.click()}
                      disabled={preview}
                      aria-label={t("notes.addImage")}
                      title={t("notes.addImage")}
                    >
                      {uploading > 0 ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                    </Button>
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
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void insertImages(Array.from(e.target.files ?? []));
                        e.target.value = "";
                      }}
                    />
                  </div>
                  {uploadError && <p className="text-xs text-rose-500">{uploadError}</p>}
                  {preview ? (
                    <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-zinc-300 p-3 dark:border-zinc-700">
                      {selected.body.trim() ? (
                        <MarkdownRenderer content={selected.body} allowImages allowHtml keepMediaLinks />
                      ) : (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("notes.bodyPlaceholder")}</p>
                      )}
                    </div>
                  ) : (
                    <Textarea
                      ref={bodyRef}
                      value={selected.body}
                      onChange={(e) => update(selected.id, { body: e.target.value })}
                      onPaste={handlePaste}
                      onDrop={handleDrop}
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
