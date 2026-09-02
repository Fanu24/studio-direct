import { afterEach, describe, expect, it, vi } from "vitest";

import type { DigestJob, DigestRecipientRow } from "@gaming/shared";

import type { DigestDatabase } from "./digest";

const now = new Date("2026-09-02T12:00:00.000Z");

const paidRow: DigestRecipientRow = {
  email: "paid@example.com",
  stripe_status: "active",
  period_end: "2026-10-01T00:00:00.000Z",
};

const hiddenJob: DigestJob = {
  title: "Senior Gameplay Engineer",
  companyName: "Alpha Studio",
  slug: "senior-gameplay-engineer",
  location: "London",
  remote: "remote",
};

function fakeDb(
  recipients: DigestRecipientRow[],
  jobs: DigestJob[],
): DigestDatabase {
  return {
    prepare(query: string) {
      return {
        bind() {
          return {
            async all<T>() {
              if (query.includes("FROM subscriptions")) {
                return { results: recipients as T[] };
              }
              if (query.includes("exclusivity = 'hidden_from_linkedin'")) {
                return { results: jobs as T[] };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };
}

describe("sendHiddenDigest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends to paid recipients with email and skips free and empty email", async () => {
    const { sendHiddenDigest } = await import("./digest");
    const send = vi.fn().mockResolvedValue(undefined);
    const recipients: DigestRecipientRow[] = [
      paidRow,
      {
        email: "free@example.com",
        stripe_status: null,
        period_end: null,
      },
      {
        email: "",
        stripe_status: "active",
        period_end: "2026-10-01T00:00:00.000Z",
      },
    ];

    const result = await sendHiddenDigest(
      {
        DB: fakeDb(recipients, [hiddenJob]),
        EMAIL: { send },
        EMAIL_FROM: "noreply@studio-direct.example",
        SITE_URL: "https://jobs.example.com",
      },
      now,
    );

    expect(result).toEqual({ sent: 1 });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "paid@example.com",
        from: "noreply@studio-direct.example",
        subject: expect.stringMatching(/not on LinkedIn/i),
        text: expect.stringContaining("Senior Gameplay Engineer"),
      }),
    );
    expect(send.mock.calls[0][0].text).not.toContain("free@example.com");
  });

  it("still sends empty-list copy to paid recipients", async () => {
    const { sendHiddenDigest } = await import("./digest");
    const send = vi.fn().mockResolvedValue(undefined);

    await sendHiddenDigest(
      {
        DB: fakeDb([paidRow], []),
        EMAIL: { send },
        EMAIL_FROM: "noreply@studio-direct.example",
      },
      now,
    );

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].text).toContain(
      "No confirmed hidden jobs are available right now.",
    );
  });

  it("queries listed remote hidden jobs and paid subscriptions joined to users", async () => {
    const { sendHiddenDigest } = await import("./digest");
    const queries: string[] = [];
    const db: DigestDatabase = {
      prepare(query: string) {
        queries.push(query);
        return {
          bind() {
            return {
              async all<T>() {
                return { results: [] as T[] };
              },
            };
          },
        };
      },
    };

    await sendHiddenDigest(
      {
        DB: db,
        EMAIL: { send: vi.fn() },
      },
      now,
    );

    const jobsSql = queries.find((query) => query.includes("FROM jobs"));
    const recipientsSql = queries.find((query) =>
      query.includes("FROM subscriptions"),
    );

    expect(jobsSql).toContain("exclusivity = 'hidden_from_linkedin'");
    expect(jobsSql).toContain("j.listed = 1");
    expect(jobsSql).toContain("c.listed = 1");
    expect(jobsSql).toContain("j.remote IN ('remote', 'hybrid')");
    expect(jobsSql).not.toContain("100%");
    expect(recipientsSql).toContain("JOIN users");
    expect(recipientsSql).toContain("stripe_status = 'active'");
    expect(recipientsSql).toContain("period_end >");
  });

  it("does not POST or fetch an OpenNext digest URL", async () => {
    const { sendHiddenDigest } = await import("./digest");
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    await sendHiddenDigest(
      {
        DB: fakeDb([paidRow], [hiddenJob]),
        EMAIL: { send: vi.fn().mockResolvedValue(undefined) },
      },
      now,
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
