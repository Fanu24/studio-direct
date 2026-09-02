import { afterEach, describe, expect, it, vi } from "vitest";

const magicLink = vi.hoisted(() => vi.fn());

vi.mock("../../lib/auth/client", () => ({
  authClient: {
    signIn: {
      magicLink,
    },
  },
}));

import { submitLoginMagicLink } from "./login-form";

describe("LoginForm Turnstile resend", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    magicLink.mockReset();
  });

  it("resets Turnstile after error and success so a second submit does not reuse a spent token", async () => {
    const tokenField = { value: "spent-token" };
    const reset = vi.fn(() => {
      tokenField.value = "fresh-token";
    });
    vi.stubGlobal("turnstile", { reset });

    magicLink
      .mockResolvedValueOnce({ error: { message: "Turnstile verification failed" } })
      .mockResolvedValueOnce({ error: null });

    const first = await submitLoginMagicLink({
      email: "dev@example.com",
      token: tokenField.value,
    });

    expect(first.error).toEqual({ message: "Turnstile verification failed" });
    expect(reset).toHaveBeenCalledTimes(1);
    expect(tokenField.value).toBe("fresh-token");

    const second = await submitLoginMagicLink({
      email: "dev@example.com",
      token: tokenField.value,
    });

    expect(second.error).toBeNull();
    expect(reset).toHaveBeenCalledTimes(2);
    expect(magicLink.mock.calls[0]?.[0].fetchOptions.headers["x-captcha-response"]).toBe(
      "spent-token",
    );
    expect(magicLink.mock.calls[1]?.[0].fetchOptions.headers["x-captcha-response"]).toBe(
      "fresh-token",
    );
  });

  it("resets Turnstile after send failure so /login can resend", async () => {
    const reset = vi.fn();
    vi.stubGlobal("turnstile", { reset });
    magicLink.mockRejectedValueOnce(new Error("Email Service unavailable"));

    await expect(
      submitLoginMagicLink({ email: "dev@example.com", token: "spent-token" }),
    ).rejects.toThrow("Email Service unavailable");

    expect(reset).toHaveBeenCalledTimes(1);
  });
});
