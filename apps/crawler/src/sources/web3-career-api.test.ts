import { describe, expect, it, vi } from "vitest";

import { fetchWeb3CareerJobs, Web3CareerApiError } from "./web3-career-api";

describe("fetchWeb3CareerJobs", () => {
  it("requests the public API and maps drafts without rewriting apply_url", async () => {
    const fetcher = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        return new Response(
          JSON.stringify([
            {
              id: "42",
              title: "Rust Engineer",
              company: "Labs",
              location: "Berlin",
              remote: false,
              salary: "$140k - $180k",
              tags: ["rust"],
              apply_url: "https://web3.career/rust-engineer-labs/42?utm_source=api",
              description: "Write rust.",
            },
          ]),
          { status: 200 },
        );
      },
    );

    const drafts = await fetchWeb3CareerJobs(
      "secret-token",
      { tag: "rust", limit: 100 },
      fetcher,
    );

    expect(drafts[0]?.applyUrl).toBe(
      "https://web3.career/rust-engineer-labs/42?utm_source=api",
    );
    expect(drafts[0]?.keepApplyUrl).toBe(true);
    expect(drafts[0]?.externalId).toBe("42");
    const requested = new URL(String(fetcher.mock.calls[0]![0]));
    expect(requested.searchParams.get("token")).toBe("secret-token");
    expect(requested.searchParams.get("tag")).toBe("rust");
    expect(requested.searchParams.get("show_description")).toBe("true");
  });

  it("surfaces 429 for retry", async () => {
    const fetcher = vi.fn(async () => new Response("rate", { status: 429 }));
    await expect(
      fetchWeb3CareerJobs("t", {}, fetcher as unknown as typeof fetch),
    ).rejects.toMatchObject({ status: 429 } satisfies Partial<Web3CareerApiError>);
  });
});
