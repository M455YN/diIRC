import { useTranslation } from "react-i18next";
import { Smile } from "lucide-react";
import Picker from "@emoji-mart/react";
import data from "@emoji-mart/data";
import { useTheme } from "next-themes";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface EmojiPickerProps {
  onChange: (value: string) => void;
  disabled?: boolean;
}

export const EmojiPicker = ({
  onChange,
  disabled,
}: EmojiPickerProps) => {
  const { t: tr } = useTranslation();
  const { resolvedTheme } = useTheme();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          className="h-7 w-7 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition flex items-center justify-center rounded-md hover:bg-zinc-300/50 dark:hover:bg-zinc-600/50 disabled:opacity-50 disabled:cursor-not-allowed outline-none"
          title={tr("cb.emojiPicker")}
        >
          <Smile className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent 
        side="right" 
        sideOffset={40}
        className="bg-transparent border-none shadow-none drop-shadow-none mb-16 p-0"
      >
        <Picker
          theme={resolvedTheme === "light" ? "light" : "dark"}
          data={data}
          onEmojiSelect={(emoji: any) => onChange(emoji.native)}
        />
      </PopoverContent>
    </Popover>
  );
};
