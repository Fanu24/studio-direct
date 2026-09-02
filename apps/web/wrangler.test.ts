import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("web wrangler", () => {
  const raw = readFileSync(new URL("./wrangler.jsonc", import.meta.url), "utf8");
  const config = JSON.parse(raw);

  it("defines only the web binding contract", () => {
    const bindings = [
      ...config.d1_databases,
      ...config.r2_buckets,
      ...config.send_email,
    ].map(({ binding, name }: { binding?: string; name?: string }) => binding ?? name);

    expect(bindings).toEqual(["DB", "FILES", "EMAIL"]);
    expect(config.queues).toBeUndefined();
  });

  it("excludes crawler and browser bindings", () => {
    expect(raw).not.toContain("CRAWL_");
    expect(raw).not.toContain("BROWSER");
  });

  it("uses node compatibility without wrangler.toml", () => {
    expect(config.compatibility_flags).toContain("nodejs_compat");
    expect(existsSync(new URL("./wrangler.toml", import.meta.url))).toBe(false);
  });
});
