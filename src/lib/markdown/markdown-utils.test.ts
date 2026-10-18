import { describe, expect, it } from "vitest";
import { extractUrlsFromMarkdownText } from "@/lib/markdown/markdown-utils";

describe("extractUrlsFromMarkdownText", () => {
  it("leaves out the URL of a markdown image but keeps plain links", () => {
    expect(extractUrlsFromMarkdownText("![raw log](https://example.com/a.png?raw=true)")).toEqual([]);
    expect(extractUrlsFromMarkdownText("see https://example.com/page ![x](https://example.com/b.png)")).toEqual([
      "https://example.com/page",
    ]);
  });
});
