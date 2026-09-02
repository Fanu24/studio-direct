import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("crawler wrangler", () => {
  const raw = readFileSync(new URL("./wrangler.jsonc", import.meta.url), "utf8");
  const config = JSON.parse(raw);

  it("defines the complete binding contract", () => {
    const bindings = [
      ...config.d1_databases,
      ...config.kv_namespaces,
      ...config.r2_buckets,
      ...config.send_email,
      ...config.queues.producers,
    ].map(({ binding, name }: { binding?: string; name?: string }) => binding ?? name);

    expect(bindings).toEqual([
      "DB",
      "LOCKS",
      "FILES",
      "EMAIL",
      "CRAWL_CAREER",
      "CRAWL_LINKEDIN",
      "CRAWL_INDEED",
    ]);
  });

  it("uses the required queues with single-message consumers", () => {
    const queueNames = ["crawl-career", "crawl-linkedin", "crawl-indeed"];

    expect(config.queues.producers.map(({ queue }: { queue: string }) => queue)).toEqual(queueNames);
    expect(config.queues.consumers).toEqual(
      queueNames.map((queue) => ({ queue, max_batch_size: 1 })),
    );
  });

  it("uses node compatibility without forbidden configuration", () => {
    expect(config.compatibility_flags).toContain("nodejs_compat");
    expect(raw).not.toContain("BROWSER");
    expect(existsSync(new URL("./wrangler.toml", import.meta.url))).toBe(false);
  });
});
