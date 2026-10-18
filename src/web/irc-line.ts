export interface IrcLine {
  tags: Record<string, string>;
  nick: string;
  user: string;
  host: string;
  /** Raw prefix: a nick!user@host or a server name. */
  prefix: string;
  cmd: string;
  params: string[];
}

const TAG_ESC: Record<string, string> = { ":": ";", s: " ", r: "\r", n: "\n", "\\": "\\" };
const unescapeTag = (v: string) => v.replace(/\\(.?)/g, (_, c) => TAG_ESC[c] ?? c);
const ESC_OUT: Record<string, string> = { ";": "\\:", " ": "\\s", "\\": "\\\\", "\r": "\\r", "\n": "\\n" };
const escapeTag = (v: string) => v.replace(/[;\s\\]/g, (c) => ESC_OUT[c] ?? c);

export function parseLine(raw: string): IrcLine | null {
  let s = raw.replace(/[\r\n]+$/, "");
  if (!s) return null;
  const tags: Record<string, string> = {};
  if (s[0] === "@") {
    const sp = s.indexOf(" ");
    if (sp < 0) return null;
    for (const t of s.slice(1, sp).split(";")) {
      const eq = t.indexOf("=");
      tags[eq < 0 ? t : t.slice(0, eq)] = eq < 0 ? "" : unescapeTag(t.slice(eq + 1));
    }
    s = s.slice(sp + 1).trimStart();
  }
  let prefix = "";
  if (s[0] === ":") {
    const sp = s.indexOf(" ");
    if (sp < 0) return null;
    prefix = s.slice(1, sp);
    s = s.slice(sp + 1).trimStart();
  }
  const params: string[] = [];
  let rest = s;
  while (rest) {
    if (rest[0] === ":") {
      params.push(rest.slice(1));
      break;
    }
    const sp = rest.indexOf(" ");
    if (sp < 0) {
      params.push(rest);
      break;
    }
    params.push(rest.slice(0, sp));
    rest = rest.slice(sp + 1).trimStart();
  }
  const cmd = (params.shift() ?? "").toUpperCase();
  if (!cmd) return null;
  const m = /^([^!@]+)(?:!([^@]*))?(?:@(.*))?$/.exec(prefix);
  return { tags, prefix, cmd, params, nick: m?.[1] ?? "", user: m?.[2] ?? "", host: m?.[3] ?? "" };
}

export function formatLine(cmd: string, params: string[], tags?: Record<string, string>): string {
  const t = tags && Object.keys(tags).length
    ? "@" + Object.entries(tags).map(([k, v]) => (v ? `${k}=${escapeTag(v)}` : k)).join(";") + " "
    : "";
  const last = params.length - 1;
  // Never let user text smuggle a second command into one frame.
  const p = params.map((x) => x.replace(/[\r\n]+/g, " ")).map((x, i) => (i === last && (x === "" || x.includes(" ") || x[0] === ":") ? ":" + x : x));
  return t + [cmd, ...p].join(" ");
}
