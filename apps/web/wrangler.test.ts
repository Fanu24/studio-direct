import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("web wrangler", () => {
  const raw = readFileSync(new URL("./wrangler.jsonc", import.meta.url), "utf8");
  const config = JSON.parse(raw);

  it("defines only the web binding contract", () => {
    const bindings = [
      config.assets.binding,
      ...config.d1_databases,
      ...config.r2_buckets,
      ...config.send_email,
    ].map((entry) =>
      typeof entry === "string"
        ? entry
        : ((entry as { binding?: string; name?: string }).binding ??
          (entry as { name?: string }).name),
    );

    expect(bindings).toEqual(["ASSETS", "DB", "FILES", "EMAIL"]);
    expect(config.queues).toBeUndefined();
    expect(config.main).toBe(".open-next/worker.js");
    expect(config.workers_dev).toBe(true);
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

  it("names Better Auth, Google, Turnstile, and Stripe secrets without values", () => {
    expect(config.vars.EMAIL_ENABLED).toBe('false');
    expect(existsSync(new URL('./.dev.vars.example',import.meta.url))).toBe(true);
    expect(raw).not.toMatch(/BETTER_AUTH_SECRET"\s*:/);
    expect(raw).not.toMatch(/GOOGLE_CLIENT_SECRET"\s*:/);
    expect(raw).not.toMatch(/TURNSTILE_SECRET_KEY"\s*:/);
    expect(raw).not.toMatch(/STRIPE_SECRET_KEY"\s*:/);
    expect(raw).not.toMatch(/STRIPE_WEBHOOK_SECRET"\s*:/);
    expect(raw).not.toMatch(/sk_(live|test)_/);
    expect(raw).not.toMatch(/whsec_/);
  });

  it("keeps Checkout behind STRIPE_ENABLED=false", () => {
    expect(config.vars.STRIPE_ENABLED).toBe("false");
  });

  it("defaults to a local origin until deployment is configured", () => {
    expect(config.vars.SITE_URL).toBe("http://localhost:3000");
  });

  it("does not ship Cloudflare always-pass Turnstile site key", () => {
    expect(config.vars.TURNSTILE_SITE_KEY).toBe("");
    expect(raw).not.toContain("1x00000000000000000000AA");
  });
});
