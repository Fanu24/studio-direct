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
    expect(config.account_id).toBe("ff222c50c538a09ccd8d08f7d47e82e8");
    expect(config.compatibility_flags).toContain("nodejs_compat");
    expect(existsSync(new URL("./wrangler.toml", import.meta.url))).toBe(false);
  });

  it("names Better Auth, Google, and Turnstile secrets without values", () => {
    expect(config.secrets.required).toEqual([
      "BETTER_AUTH_SECRET",
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "TURNSTILE_SECRET_KEY",
    ]);
    expect(raw).not.toMatch(/BETTER_AUTH_SECRET"\s*:/);
    expect(raw).not.toMatch(/GOOGLE_CLIENT_SECRET"\s*:/);
    expect(raw).not.toMatch(/TURNSTILE_SECRET_KEY"\s*:/);
  });
});
