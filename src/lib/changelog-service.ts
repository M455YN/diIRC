import { useState, useEffect } from "react";
import tauriConfig from "../../src-tauri/tauri.conf.json";
import { useMockStore } from "@/lib/mock-store";
import {
  BUILD_UPDATE_CHANNEL,
  UPDATE_CHANNELS,
  resolveUpdateChannelId,
  type UpdateChannelId,
} from "@/lib/update-service";

export interface ChangelogVersion {
  version: string;
  cleanVersion: string;
  filename: string;
  content: string;
  /** Update channel the notes were published on. */
  channel: UpdateChannelId;
}

export interface ChangelogState {
  versions: ChangelogVersion[];
  hasCurrentVersion: boolean;
  currentVersion: string;
  loading: boolean;
  error: string | null;
}

const VERSION_PATTERN = /^v?(\d+(?:\.\d+)*)(?:-(\d+))?$/i;

/**
 * Parse version string into numeric array for semver comparison.
 * e.g., "v0.2.7" -> [0, 2, 7]; prerelease suffixes ("0.3.5-1") are ignored here.
 */
export function parseVersionNumbers(versionStr: string): number[] {
  const clean = versionStr.replace(/^v/i, "").trim().split("-")[0];
  return clean.split(".").map((part) => {
    const num = parseInt(part, 10);
    return isNaN(num) ? 0 : num;
  });
}

/** Numeric prerelease (`0.3.5-2` -> 2); releases without one sort above all their prereleases. */
const prereleaseNumber = (versionStr: string): number => {
  const match = VERSION_PATTERN.exec(versionStr.trim());
  return match?.[2] !== undefined ? parseInt(match[2], 10) : Number.POSITIVE_INFINITY;
};

/**
 * Compare two version strings descending (newest version first).
 */
export function compareVersionsDescending(a: string, b: string): number {
  const numsA = parseVersionNumbers(a);
  const numsB = parseVersionNumbers(b);
  const maxLength = Math.max(numsA.length, numsB.length);

  for (let i = 0; i < maxLength; i++) {
    const valA = numsA[i] ?? 0;
    const valB = numsB[i] ?? 0;
    if (valA > valB) return -1;
    if (valA < valB) return 1;
  }
  const preA = prereleaseNumber(a);
  const preB = prereleaseNumber(b);
  if (preA === preB) return 0;
  return preA > preB ? -1 : 1;
}

export const getCurrentAppVersion = (): string => {
  return tauriConfig.version || "0.2.7";
};

const getActiveChangelogChannel = (): UpdateChannelId => {
  const resolved = resolveUpdateChannelId(useMockStore.getState().updateSourceMode);
  return resolved === "custom" ? BUILD_UPDATE_CHANNEL : resolved;
};

const toEntry = (rawVersion: string, filename: string, content: string, channel: UpdateChannelId) => {
  const cleanVersion = rawVersion.replace(/^v/i, "").trim();
  return { version: `v${cleanVersion}`, cleanVersion, filename, content, channel };
};

const cacheBust = (url: string) => `${url}${url.includes("?") ? "&" : "?"}_t=${Date.now()}`;

const fetchGitHubJson = async (url: string, notFoundMessage: string) => {
  const response = await fetch(cacheBust(url), {
    headers: { Accept: "application/vnd.github+json" },
  }).catch(() => {
    throw new Error("Unable to connect to GitHub. Please check your internet connection and try again.");
  });
  if (!response.ok) {
    if (response.status === 404) throw new Error(notFoundMessage);
    if (response.status === 403) throw new Error("GitHub rate limit reached. Please try again later.");
    throw new Error(`Failed to fetch changelog (HTTP ${response.status}).`);
  }
  return response.json();
};

/** Notes stored as `<version>.md` files in a Gist. */
const fetchGistNotes = async (gistId: string, channel: UpdateChannelId): Promise<ChangelogVersion[]> => {
  const data = await fetchGitHubJson(
    `https://api.github.com/gists/${gistId}`,
    "Changelog Gist repository not found (HTTP 404)."
  );
  const entries: ChangelogVersion[] = [];
  for (const [filename, fileData] of Object.entries<any>(data?.files || {})) {
    if (!filename.endsWith(".md") && !/^v?\d+/i.test(filename)) continue;
    let content = fileData.content || "";
    // Fallback only if content is missing/truncated from Gist API payload
    if (!content && fileData.raw_url) {
      const rawRes = await fetch(cacheBust(fileData.raw_url)).catch(() => null);
      if (rawRes && rawRes.ok) content = await rawRes.text();
    }
    entries.push(toEntry(filename.replace(/\.md$/i, "").trim(), filename, content, channel));
  }
  return entries;
};

/** Notes stored as GitHub release bodies; the version comes from the tag or the asset names. */
const fetchReleaseNotes = async (repo: string, channel: UpdateChannelId): Promise<ChangelogVersion[]> => {
  const releases = await fetchGitHubJson(
    `https://api.github.com/repos/${repo}/releases?per_page=50`,
    "Release notes repository not found (HTTP 404)."
  );
  const entries: ChangelogVersion[] = [];
  for (const release of Array.isArray(releases) ? releases : []) {
    if (release.draft) continue;
    let version = VERSION_PATTERN.test(release.tag_name ?? "") ? release.tag_name : null;
    if (!version) {
      const asset = (release.assets ?? []).find((a: any) => /_(\d+\.\d+\.\d+(?:-\d+)?)_/.test(a.name));
      version = asset ? /_(\d+\.\d+\.\d+(?:-\d+)?)_/.exec(asset.name)?.[1] ?? null : null;
    }
    if (!version) continue;
    entries.push(toEntry(version, release.tag_name, release.body || "", channel));
  }
  return entries;
};

const fetchChannelNotes = async (channelId: UpdateChannelId): Promise<ChangelogVersion[]> => {
  const { gistId, releasesRepo } = UPDATE_CHANNELS[channelId].changelog;
  if (gistId) return fetchGistNotes(gistId, channelId);
  if (releasesRepo) return fetchReleaseNotes(releasesRepo, channelId);
  return [];
};

/** Per-channel cache & listener subscription pattern */
const cachedStates = new Map<UpdateChannelId, ChangelogState>();
const fetchPromises = new Map<UpdateChannelId, Promise<ChangelogState>>();
const listeners = new Set<(channel: UpdateChannelId, state: ChangelogState) => void>();

function notifyListeners(channel: UpdateChannelId, state: ChangelogState) {
  cachedStates.set(channel, state);
  listeners.forEach((fn) => fn(channel, state));
}

export async function fetchChangelogData(
  forceRefresh = false,
  channel: UpdateChannelId = getActiveChangelogChannel()
): Promise<ChangelogState> {
  const cached = cachedStates.get(channel);
  if (cached && !forceRefresh) return cached;

  const pending = fetchPromises.get(channel);
  if (pending && !forceRefresh) return pending;

  const currentVer = getCurrentAppVersion();
  const cleanCurrentVer = currentVer.replace(/^v/i, "").trim();

  if (forceRefresh && cached) {
    notifyListeners(channel, { ...cached, loading: true, error: null });
  }

  const promise = (async () => {
    try {
      const { includeChannel } = UPDATE_CHANNELS[channel].changelog;
      const [own, included] = await Promise.all([
        fetchChannelNotes(channel),
        // Notes of the base channel are optional: a failure there must not hide this channel's notes.
        includeChannel ? fetchChannelNotes(includeChannel).catch(() => []) : Promise.resolve([]),
      ]);

      const seen = new Set(own.map((entry) => entry.cleanVersion.toLowerCase()));
      const versionList = [
        ...own,
        ...included.filter((entry) => !seen.has(entry.cleanVersion.toLowerCase())),
      ].sort((a, b) => compareVersionsDescending(a.version, b.version));

      const state: ChangelogState = {
        versions: versionList,
        hasCurrentVersion: versionList.some(
          (item) => item.cleanVersion.toLowerCase() === cleanCurrentVer.toLowerCase()
        ),
        currentVersion: currentVer,
        loading: false,
        error: null,
      };
      notifyListeners(channel, state);
      return state;
    } catch (err: any) {
      console.error("Changelog fetch error:", err);
      const previous = cachedStates.get(channel);
      const errorState: ChangelogState = {
        versions: previous?.versions || [],
        hasCurrentVersion: previous?.hasCurrentVersion || false,
        currentVersion: currentVer,
        loading: false,
        error: err?.message || "Failed to load changelog. Please check your network connection.",
      };
      notifyListeners(channel, errorState);
      return errorState;
    } finally {
      fetchPromises.delete(channel);
    }
  })();

  fetchPromises.set(channel, promise);
  return promise;
}

const loadingState = (): ChangelogState => ({
  versions: [],
  hasCurrentVersion: false,
  currentVersion: getCurrentAppVersion(),
  loading: true,
  error: null,
});

/** Hook to consume the changelog of the active update channel, synchronized across components */
export function useChangelog() {
  const updateSourceMode = useMockStore((state) => state.updateSourceMode);
  const resolved = resolveUpdateChannelId(updateSourceMode);
  const channel: UpdateChannelId = resolved === "custom" ? BUILD_UPDATE_CHANNEL : resolved;

  const [state, setState] = useState<ChangelogState>(() => cachedStates.get(channel) || loadingState());

  useEffect(() => {
    setState(cachedStates.get(channel) || loadingState());

    const handleUpdate = (updatedChannel: UpdateChannelId, newState: ChangelogState) => {
      if (updatedChannel === channel) setState(newState);
    };
    listeners.add(handleUpdate);

    if (!cachedStates.has(channel) && !fetchPromises.has(channel)) {
      void fetchChangelogData(false, channel);
    }

    return () => {
      listeners.delete(handleUpdate);
    };
  }, [channel]);

  return {
    ...state,
    channel,
    refresh: () => fetchChangelogData(true, channel),
  };
}
