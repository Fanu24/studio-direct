import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("crawler health", () => {
  it("reports the crawler worker as healthy", async () => {
    const response = await SELF.fetch("https://crawler.test/health");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      worker: "crawler",
    });
  });
});
