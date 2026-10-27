import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { useAvatarStore } from "@/hooks/use-avatar-store";
import { setOwnAvatar, type AvatarCrop } from "@/lib/avatars";
import { AvatarCropper } from "./avatar-cropper";

/** Picks, previews and removes our own (experimental) avatar for one server. */
export const AvatarUpload = ({ serverId }: { serverId: string }) => {
  const { t } = useTranslation();
  const own = useAvatarStore((state) => state.own[serverId]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<File | null>(null);

  const change = async (file: File | null, crop?: AvatarCrop) => {
    setBusy(true);
    setError(null);
    try {
      await setOwnAvatar(serverId, file, crop);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-x-3">
        <UserAvatar src={own?.dataUrl} name="?" className="h-12 w-12 md:h-12 md:w-12" />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (file) setPicked(file);
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {t("server.avatar.choose")}
        </Button>
        {own && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void change(null)}>
            {t("server.avatar.remove")}
          </Button>
        )}
      </div>
      {picked && (
        <AvatarCropper
          file={picked}
          onCancel={() => setPicked(null)}
          onConfirm={(crop) => {
            void change(picked, crop);
            setPicked(null);
          }}
        />
      )}
      {error && <p className="text-xs text-rose-500">{error}</p>}
    </div>
  );
};
