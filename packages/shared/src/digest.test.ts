import { describe, expect, it } from "vitest";

import { buildDigestEmail, filterDigestRecipients } from "./digest.ts";
import { TENANT_NAME } from "./tenant.ts";

const now = new Date("2026-09-02T12:00:00.000Z");

describe("filterDigestRecipients", () => {
  it("skips free users", () => {
    expect(
      filterDigestRecipients(
        [
          {
            email: "free@example.com",
            stripe_status: null,
            period_end: null,
          },
          {
            email: "canceled@example.com",
            stripe_status: "canceled",
            period_end: "2026-10-01T00:00:00.000Z",
          },
        ],
        now,
      ),
    ).toEqual([]);
  });

  it("includes paid users with an email whose period has not ended", () => {
    expect(
      filterDigestRecipients(
        [
          {
            email: "paid@example.com",
            stripe_status: "active",
            period_end: "2026-10-01T00:00:00.000Z",
          },
        ],
        now,
      ),
    ).toEqual([{ email: "paid@example.com" }]);
  });

  it("skips empty email even when the subscription is paid", () => {
    expect(
      filterDigestRecipients(
        [
          {
            email: "",
            stripe_status: "active",
            period_end: "2026-10-01T00:00:00.000Z",
          },
          {
            email: "   ",
            stripe_status: "active",
            period_end: "2026-10-01T00:00:00.000Z",
          },
          {
            email: null,
            stripe_status: "active",
            period_end: "2026-10-01T00:00:00.000Z",
          },
        ],
        now,
      ),
    ).toEqual([]);
  });

  it("skips an active status whose period has already ended", () => {
    expect(
      filterDigestRecipients(
        [
          {
            email: "expired@example.com",
            stripe_status: "active",
            period_end: "2026-09-01T00:00:00.000Z",
          },
        ],
        now,
      ),
    ).toEqual([]);
  });
});

describe("buildDigestEmail", () => {
  it("still has copy when the hidden list is empty", () => {
    const email = buildDigestEmail({ jobs: [] });

    expect(email.subject).toMatch(/not on LinkedIn/i);
    expect(email.text).toContain(
      "No confirmed hidden jobs are available right now.",
    );
    expect(email.html).toContain(
      "No confirmed hidden jobs are available right now.",
    );
    expect(email.text).toContain("last successful index");
    expect(email.html).toContain("last successful index");
  });

  it("names the product Nodework, never the old Studio Direct name", () => {
    const email = buildDigestEmail({ jobs: [] });

    expect(email.subject).toContain(TENANT_NAME);
    expect(email.subject).not.toMatch(/Studio Direct/i);
  });

  it("lists confirmed hidden jobs without claiming 100% or real-time LinkedIn", () => {
    const email = buildDigestEmail({
      jobs: [
        {
          title: "Senior Gameplay Engineer",
          companyName: "Alpha Studio",
          slug: "senior-gameplay-engineer",
          location: "London",
          remote: "remote",
        },
      ],
      siteUrl: "https://jobs.example.com",
    });

    expect(email.text).toContain("Senior Gameplay Engineer");
    expect(email.text).toContain("Alpha Studio");
    expect(email.text).toContain(
      "https://jobs.example.com/jobs/senior-gameplay-engineer",
    );
    expect(email.html).toContain("Senior Gameplay Engineer");
    expect(email.text).not.toContain("100%");
    expect(email.html).not.toContain("100%");
    expect(email.text).not.toMatch(/real-time LinkedIn(?! check)/i);
    expect(email.text.toLowerCase()).not.toMatch(
      /real-time linkedin (coverage|index|updates)/i,
    );
  });
});
