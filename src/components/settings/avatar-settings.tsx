import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, ImagePlus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/user-avatar";
import { useModal } from "@/hooks/use-modal-store";
import { getServerActiveNick, useMockStore } from "@/lib/mock-store";
import { resizeAvatarFile } from "@/lib/avatar";
import { uploadImage } from "@/lib/upload/services";

interface AvatarSettingsProps {
  serverId?: string;
}

export const AvatarSettings = ({ serverId }: AvatarSettingsProps) => {
  const { onOpen } = useModal();
  const params = useParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const servers = useMockStore((state) => state.servers);
  const setOwnAvatar = useMockStore((state) => state.setOwnAvatar);
  const uploadConfig = useMockStore((state) => state.uploadConfig);
  const locked = Boolean(serverId);

  const defaultServerId = useMemo(() => {
    if (serverId) return serverId;
    if (params.serverId && servers.some((server) => server.id === params.serverId)) {
      return params.serverId;
    }
    return servers[0]?.id || "";
  }, [serverId, params.serverId, servers]);

  const [selectedServerId, setSelectedServerId] = useState(defaultServerId);

  useEffect(() => {
    setSelectedServerId(defaultServerId);
  }, [defaultServerId]);

  const server = servers.find((item) => item.id === selectedServerId) || servers[0];
  const ownAvatarUrl = server?.avatarUrl || null;
  const recentAvatarUrls = server?.recentAvatarUrls || [];
  const displayName = server ? getServerActiveNick(server) : "You";
  const providerReady = uploadConfig.provider !== "disabled";
  const providerLabel =
    uploadConfig.provider === "pomf"
      ? "POMF"
      : uploadConfig.provider === "litterbox"
        ? "Litterbox"
        : "Disabled";

  const handleFile = async (file: File | undefined) => {
    if (!file || !server) return;
    if (!providerReady) {
      onOpen("ircError", {
        title: "Image upload is disabled",
        description: "Enable an image upload provider in Settings before setting an avatar.",
      });
      return;
    }
    setBusy(true);
    try {
      const resized = await resizeAvatarFile(file);
      const url = await uploadImage(resized, uploadConfig);
      setOwnAvatar(server.id, url);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      onOpen("ircError", {
        title: "Avatar upload failed",
        description: message,
      });
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700/60 bg-zinc-50 dark:bg-[#2b2d31] p-4 space-y-3 shadow-sm transition">
      <div className="flex items-center gap-x-2">
        <User className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
        <label className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
          Chat avatar
        </label>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
        Per IRC server. Uploads a 128×128 copy through your image provider and announces it only on this server.
      </p>

      {!locked && servers.length > 1 && (
        <select
          value={selectedServerId}
          onChange={(event) => setSelectedServerId(event.target.value)}
          className="w-full bg-white dark:bg-[#1e1f22] border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {servers.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      )}

      {!server ? (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          Add an IRC server first to set an avatar.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-x-3">
            <UserAvatar
              src={ownAvatarUrl || undefined}
              name={displayName}
              className="h-14 w-14 md:h-14 md:w-14"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !providerReady}
                onClick={() => inputRef.current?.click()}
                className="h-8 text-xs"
              >
                <ImagePlus className="w-3.5 h-3.5 mr-1.5" />
                {busy ? "Uploading..." : "Choose image"}
              </Button>
              {ownAvatarUrl && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setOwnAvatar(server.id, null)}
                  className="h-8 text-xs text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                  Clear
                </Button>
              )}
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
          </div>

          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            Current upload provider: {providerLabel}. Change it in Settings → Image upload provider.
          </p>
          {uploadConfig.provider === "litterbox" && (
            <div className="flex items-start gap-x-1.5 text-[11px] text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Litterbox files expire, so other clients may stop loading this avatar.
              </span>
            </div>
          )}

          {recentAvatarUrls.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                Recent avatars
              </p>
              <div className="flex items-center gap-x-2">
                {recentAvatarUrls.map((url) => (
                  <button
                    key={url}
                    type="button"
                    title="Use this avatar"
                    onClick={() => setOwnAvatar(server.id, url)}
                    className={`rounded-full ring-2 transition ${
                      url === ownAvatarUrl
                        ? "ring-indigo-500"
                        : "ring-transparent hover:ring-zinc-400 dark:hover:ring-zinc-500"
                    }`}
                  >
                    <UserAvatar src={url} name={displayName} className="h-9 w-9 md:h-9 md:w-9" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
