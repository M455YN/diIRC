import { invoke } from "@tauri-apps/api/core";
import { isValidAvatarUrl, resizeAvatarDataUrl } from "@/lib/avatar";

const memory = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();
const MAX_MEMORY = 80;
const FETCH_CONCURRENCY = 3;

let activeFetches = 0;
const fetchWaiters: Array<() => void> = [];

function remember(url: string, dataUrl: string) {
  if (memory.has(url)) memory.delete(url);
  memory.set(url, dataUrl);
  if (memory.size > MAX_MEMORY) {
    const first = memory.keys().next().value;
    if (first) memory.delete(first);
  }
}

function acquireFetchSlot(): Promise<void> {
  if (activeFetches < FETCH_CONCURRENCY) {
    activeFetches += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    fetchWaiters.push(() => {
      activeFetches += 1;
      resolve();
    });
  });
}

function releaseFetchSlot() {
  activeFetches = Math.max(0, activeFetches - 1);
  const next = fetchWaiters.shift();
  if (next) next();
}

export async function resolveAvatarSrc(url: string | undefined): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (!isValidAvatarUrl(url)) return undefined;
  const cached = memory.get(url);
  if (cached) return cached;
  const pending = inflight.get(url);
  if (pending) return pending;

  const task = (async () => {
    const fromDisk = await invoke<string | null>("load_cached_avatar", { url }).catch(() => null);
    if (fromDisk) {
      remember(url, fromDisk);
      return fromDisk;
    }
    await acquireFetchSlot();
    try {
      const fetched = await invoke<string>("fetch_image_proxy", { url });
      const resized = await resizeAvatarDataUrl(fetched);
      invoke("store_cached_avatar", { url, dataUrl: resized }).catch(() => {});
      remember(url, resized);
      return resized;
    } finally {
      releaseFetchSlot();
    }
  })().finally(() => {
    inflight.delete(url);
  });

  inflight.set(url, task);
  return task;
}
