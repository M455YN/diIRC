import { useTranslation } from "react-i18next";
import { typingChatKey, useTypingStore } from "@/hooks/use-typing-store";

const NONE: string[] = [];

/** "alice is typing…" line above the message box; keeps its height so the layout does not jump. */
export const TypingIndicator = ({ serverId, target }: { serverId: string; target: string }) => {
  const { t } = useTranslation();
  const nicks = useTypingStore((state) => state.typing[typingChatKey(serverId, target)] ?? NONE);

  let text = "";
  if (nicks.length === 1) text = t("chat.typing.one", { a: nicks[0] });
  else if (nicks.length === 2) text = t("chat.typing.two", { a: nicks[0], b: nicks[1] });
  else if (nicks.length === 3) text = t("chat.typing.three", { a: nicks[0], b: nicks[1], c: nicks[2] });
  else if (nicks.length > 3) text = t("chat.typing.many", { a: nicks[0], b: nicks[1], count: nicks.length - 2 });

  return (
    <div className="h-5 truncate px-4 text-xs italic text-zinc-500 dark:text-zinc-400" aria-live="polite">
      {text}
    </div>
  );
};
