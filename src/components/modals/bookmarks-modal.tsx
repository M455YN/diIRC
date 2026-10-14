import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModal } from "@/hooks/use-modal-store";
import { useBookmarkStore } from "@/hooks/use-bookmark-store";
import { focusChatMessage } from "@/hooks/use-reply-store";

export const BookmarksModal = () => {
  const { t } = useTranslation();
  const { isOpen, onClose, type } = useModal();
  const isModalOpen = isOpen && type === "bookmarks";
  const navigate = useNavigate();
  const bookmarks = useBookmarkStore((state) => state.bookmarks);
  const remove = useBookmarkStore((state) => state.remove);

  const jump = (path: string, messageId: string) => {
    onClose();
    navigate(path);
    // shortcut: fixed 300ms wait for the chat to mount before scrolling, replace with a ready event.
    setTimeout(() => focusChatMessage(messageId), 300);
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("chat.header.bookmarks")}</DialogTitle>
          <DialogDescription>{t("chat.bookmarks.desc")}</DialogDescription>
        </DialogHeader>

        {bookmarks.length === 0 ? (
          <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {t("chat.bookmarks.empty")}
          </div>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {bookmarks.map((bookmark) => (
              <li
                key={bookmark.messageId}
                className="group flex items-start gap-x-2 rounded-md border border-zinc-200 dark:border-zinc-700 p-2.5"
              >
                <button
                  type="button"
                  onClick={() => jump(bookmark.path, bookmark.messageId)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-baseline gap-x-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span className="font-semibold text-zinc-700 dark:text-zinc-200">{bookmark.nick}</span>
                    <span className="truncate">{bookmark.chatLabel}</span>
                    <span className="ml-auto shrink-0">{bookmark.timestamp}</span>
                  </div>
                  <p className="mt-1 line-clamp-3 whitespace-pre-wrap break-words text-sm text-zinc-800 dark:text-zinc-100">
                    {bookmark.content}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => remove(bookmark.messageId)}
                  aria-label={t("chat.item.removeBookmark")}
                  className="shrink-0 rounded-sm p-1 text-zinc-500 transition hover:bg-zinc-100 hover:text-rose-500 dark:hover:bg-zinc-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
};
