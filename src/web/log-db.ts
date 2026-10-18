// Chat logs in IndexedDB instead of files on disk. `offset` = auto-increment key, so the
// frontend's offset-based paging (before/after) works unchanged.
export interface LogRow {
  offset?: number;
  key: string; // `${serverId}\0${target.toLowerCase()}`
  serverId: string;
  target: string;
  id: string;
  timestamp: string;
  sender: string;
  content: string;
  msgid?: string;
  replyToMsgid?: string;
  replyNick?: string;
  replyPreview?: string;
}

const PAGE = 200;
let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open("luna-logs", 1);
    req.onupgradeneeded = () => {
      const s = req.result.createObjectStore("lines", { keyPath: "offset", autoIncrement: true });
      s.createIndex("key", ["key", "offset"]);
      s.createIndex("server", "serverId");
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

const done = <T,>(r: IDBRequest<T>) =>
  new Promise<T>((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });

const keyOf = (serverId: string, target: string) => `${serverId}\0${target.toLowerCase()}`;

export const localTimestamp = (d = new Date()) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};

export async function appendLog(row: Omit<LogRow, "key" | "offset" | "id"> & { id?: string }): Promise<string> {
  const id = row.id ?? crypto.randomUUID();
  const d = await db();
  await done(d.transaction("lines", "readwrite").objectStore("lines").add({ ...row, id, key: keyOf(row.serverId, row.target) }));
  return id;
}

async function range(serverId: string, target: string, lo: number, hi: number, dir: IDBCursorDirection, limit: number) {
  const k = keyOf(serverId, target);
  const d = await db();
  const idx = d.transaction("lines").objectStore("lines").index("key");
  const out: LogRow[] = [];
  await new Promise<void>((resolve, reject) => {
    const req = idx.openCursor(IDBKeyRange.bound([k, lo], [k, hi], false, false), dir);
    req.onsuccess = () => {
      const c = req.result;
      if (!c || out.length >= limit) return resolve();
      out.push(c.value);
      c.continue();
    };
    req.onerror = () => reject(req.error);
  });
  return out;
}

const toEntry = (r: LogRow) => ({
  id: r.id, timestamp: r.timestamp, sender: r.sender, content: r.content, offset: r.offset,
  msgid: r.msgid, replyToMsgid: r.replyToMsgid, replyNick: r.replyNick, replyPreview: r.replyPreview,
});

export async function loadTail(serverId: string, target: string) {
  const rows = await range(serverId, target, 0, Number.MAX_SAFE_INTEGER, "prev", PAGE);
  return rows.reverse().map(toEntry);
}

export async function loadPage(serverId: string, target: string, before?: number | null, after?: number | null) {
  if (after != null) {
    const rows = await range(serverId, target, after + 1, Number.MAX_SAFE_INTEGER, "next", PAGE);
    return { entries: rows.map(toEntry), nextOffset: null, nextAfter: rows.length === PAGE ? rows[rows.length - 1].offset : null };
  }
  const rows = await range(serverId, target, 0, before != null ? before - 1 : Number.MAX_SAFE_INTEGER, "prev", PAGE);
  rows.reverse();
  return { entries: rows.map(toEntry), nextOffset: rows.length === PAGE ? rows[0].offset : null, nextAfter: null };
}

export async function listConversations(serverId: string): Promise<string[]> {
  const d = await db();
  const rows: LogRow[] = await done(d.transaction("lines").objectStore("lines").index("server").getAll(serverId));
  const seen = new Map<string, string>();
  for (const r of rows) if (!/^[#&]/.test(r.target) && r.target !== "***" && r.target.trim()) seen.set(r.target.toLowerCase(), r.target);
  return [...seen.values()];
}

export async function deleteLast(serverId: string, target: string, sender: string): Promise<boolean> {
  const rows = await range(serverId, target, 0, Number.MAX_SAFE_INTEGER, "prev", 50);
  const hit = rows.find((r) => r.sender.toLowerCase() === sender.toLowerCase());
  if (!hit) return false;
  const d = await db();
  await done(d.transaction("lines", "readwrite").objectStore("lines").delete(hit.offset!));
  return true;
}

export async function findByMsgid(serverId: string, target: string, msgid: string) {
  const rows = await range(serverId, target, 0, Number.MAX_SAFE_INTEGER, "prev", 5000);
  const hit = rows.find((r) => r.msgid === msgid);
  return hit ? toEntry(hit) : null;
}

/** Subset of the desktop search: terms, phrases, exclusions, senders, limit/order. */
export async function searchLog(serverId: string, target: string, c: any) {
  const rows = await range(serverId, target, 0, Number.MAX_SAFE_INTEGER, c.order === "oldest" ? "next" : "prev", Number.MAX_SAFE_INTEGER);
  const has = (s: string, t: string) => s.includes(t.toLowerCase());
  const senders = (c.senders ?? []).map((s: string) => s.toLowerCase());
  const hits = rows.filter((r) => {
    const t = r.content.toLowerCase();
    return (c.terms ?? []).every((x: string) => has(t, x)) && (c.phrases ?? []).every((x: string) => has(t, x))
      && !(c.excludeTerms ?? []).some((x: string) => has(t, x)) && !(c.excludePhrases ?? []).some((x: string) => has(t, x))
      && (!senders.length || senders.includes(r.sender.toLowerCase()))
      && (!c.mention || has(t, c.mention))
      && (!c.after || r.timestamp >= c.after) && (!c.before || r.timestamp <= c.before)
      && (c.beforeOffset == null || r.offset! < c.beforeOffset) && (c.afterOffset == null || r.offset! > c.afterOffset);
  });
  return hits.slice(0, c.limit ?? 200).map((r) => ({ timestamp: r.timestamp, sender: r.sender, content: r.content, offset: r.offset }));
}
