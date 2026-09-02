import { describe, expect, it, vi } from "vitest";

import { sendMagicLinkEmail } from "./email";

describe("sendMagicLinkEmail", () => {
  it("logs and rethrows when EMAIL.send fails so /login can resend", async () => {
    const log = { error: vi.fn() };
    const email = {
      send: vi.fn().mockRejectedValue(new Error("Email Service unavailable")),
    };

    await expect(
      sendMagicLinkEmail({
        email,
        to: "dev@example.com",
        url: "https://jobs.example.com/api/auth/magic-link/verify?token=abc",
        from: "noreply@example.com",
        log,
      }),
    ).rejects.toThrow("Email Service unavailable");

    expect(log.error).toHaveBeenCalledWith(
      "Magic link email send failed",
      expect.objectContaining({
        email: "dev@example.com",
        error: expect.any(Error),
      }),
    );
    expect(email.send).toHaveBeenCalledTimes(1);
  });
});
