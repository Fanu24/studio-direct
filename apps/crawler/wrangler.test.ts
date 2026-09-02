import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("crawler wrangler", () => {
  const raw = readFileSync(new URL("./wrangler.jsonc", import.meta.url), "utf8");

  it("is jsonc and names crawl queues", () => {
    expect(raw).toContain("crawl-career");
    expect(raw).toContain("CRAWL_CAREER");
    expect(raw).not.toContain("wrangler.toml");
  });
});
