import { describe, expect, it } from "vitest";

import { buildDigestEmail, filterDigestRecipients } from "./digest";

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
        ],
        now,
      ),
    ).toEqual([]);
  });
});

describe("buildDigestEmail", () => {
  it("still has copy when the hidden list is empty", () => {
    const email = buildDigestEmail({ jobs: [] });

    expect(email.text).toContain(
      "No confirmed hidden jobs are available right now.",
    );
    expect(email.html).toContain(
      "No confirmed hidden jobs are available right now.",
    );
    expect(email.text).not.toContain("100%");
    expect(email.html).not.toContain("100%");
  });
});
