import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DEFAULT_SERVER_IMAGE, readServerLogo } from "@/lib/server-logo";

interface ServerLogoFieldProps {
  value: string;
  onChange: (imageUrl: string) => void;
  disabled?: boolean;
}

export const ServerLogoField = ({ value, onChange, disabled }: ServerLogoFieldProps) => {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const hasCustomLogo = Boolean(value) && value !== DEFAULT_SERVER_IMAGE;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setError(null);
      onChange(await readServerLogo(file));
    } catch (err) {
      setError(err instanceof Error && err.message.startsWith("serverLogo.") ? t(err.message) : t("serverLogo.readFailed"));
    }
  };

  return (
    <div className="flex items-center gap-x-4">
      <img
        src={value || DEFAULT_SERVER_IMAGE}
        alt={t("chat.logo.alt")}
        className="h-16 w-16 shrink-0 rounded-2xl object-cover ring-1 ring-zinc-300 dark:ring-zinc-700"
      />
      <div className="flex min-w-0 flex-col items-start gap-y-1.5">
        <div className="flex gap-x-2">
          <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
            <ImagePlus className="mr-1.5 h-4 w-4" />
            {t("chat.logo.choose")}
          </Button>
          {hasCustomLogo && (
            <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onChange(DEFAULT_SERVER_IMAGE)}>
              <X className="mr-1.5 h-4 w-4" />
              {t("chat.logo.remove")}
            </Button>
          )}
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("chat.logo.localOnly")}</p>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      </div>
    </div>
  );
};
