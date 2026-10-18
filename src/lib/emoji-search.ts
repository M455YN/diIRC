export interface EmojiMatch {
  id: string;
  native: string;
}

interface EmojiEntry extends EmojiMatch {
  name: string;
  keywords: string[];
}

let entries: Promise<EmojiEntry[]> | null = null;

// The emoji data is large, so it is loaded the first time someone types `:xx`.
function load(): Promise<EmojiEntry[]> {
  entries ??= import("@emoji-mart/data").then(({ default: data }) =>
    Object.values((data as { emojis: Record<string, { id: string; name: string; keywords?: string[]; skins: { native: string }[] }> }).emojis).map(
      (emoji) => ({ id: emoji.id, name: emoji.name.toLowerCase(), keywords: emoji.keywords ?? [], native: emoji.skins[0]?.native ?? "" })
    )
  );
  return entries;
}

/** Emoji whose id starts with `query` first, then ones whose id, name or keywords contain it. */
export async function searchEmoji(query: string, limit = 8): Promise<EmojiMatch[]> {
  const q = query.toLowerCase();
  if (q.length < 2) return [];
  const all = await load();
  const starts: EmojiEntry[] = [];
  const contains: EmojiEntry[] = [];
  for (const entry of all) {
    if (entry.id.startsWith(q)) starts.push(entry);
    else if (entry.id.includes(q) || entry.name.includes(q) || entry.keywords.some((keyword) => keyword.startsWith(q))) contains.push(entry);
    if (starts.length >= limit) break;
  }
  return [...starts, ...contains].slice(0, limit).map(({ id, native }) => ({ id, native }));
}
