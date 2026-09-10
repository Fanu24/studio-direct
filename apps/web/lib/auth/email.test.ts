import { describe, expect, it, vi } from "vitest";

import { TENANT_NAME } from "@gaming/shared";

import { sendMagicLinkEmail } from "./email";

describe("sendMagicLinkEmail", () => {
  it("names the product Nodework, never the old Studio Direct name", async () => {
    const sent: { subject: string; text: string; html: string }[] = [];
    const email = {
      send: vi.fn(async (message: { subject: string; text: string; html: string }) => {
        sent.push(message);
      }),
    };

    await sendMagicLinkEmail({
      email,
      to: "reader@example.com",
      url: "https://example.com/x",
      from: "noreply@example.com",
    });

    expect(sent).toHaveLength(1);
    const [message] = sent;
    for (const field of [message.subject, message.text, message.html]) {
      expect(field).toContain(TENANT_NAME);
      expect(field).not.toMatch(/Studio Direct/i);
    }
  });

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
