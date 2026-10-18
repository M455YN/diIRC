import { describe, expect, it } from "vitest";
import { formatLine, parseLine } from "./irc-line";

describe("irc-line", () => {
  it("parses tags, prefix and trailing", () => {
    const l = parseLine("@time=2024-01-01T00:00:00.000Z;msgid=a\\sb :n!u@h PRIVMSG #c :hi there\r\n")!;
    expect(l.tags.msgid).toBe("a b");
    expect([l.nick, l.user, l.host, l.cmd, l.params]).toEqual(["n", "u", "h", "PRIVMSG", ["#c", "hi there"]]);
  });
  it("formats and blocks line injection", () => {
    expect(formatLine("PRIVMSG", ["#c", "a b"])).toBe("PRIVMSG #c :a b");
    expect(formatLine("PRIVMSG", ["#c", "x\r\nQUIT"])).toBe("PRIVMSG #c :x QUIT");
  });
});
