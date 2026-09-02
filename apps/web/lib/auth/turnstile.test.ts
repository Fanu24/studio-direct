import { describe, expect, it, vi } from "vitest";

import {
  isEmailAuthPath,
  turnstileTokenFromRequest,
  verifyTurnstile,
} from "./turnstile";

describe("verifyTurnstile", () => {
  it("returns 400 when the token is missing", async () => {
    const fetchMock = vi.fn();

    const result = await verifyTurnstile({
      token: undefined,
      secretKey: "turnstile-secret",
      fetch: fetchMock,
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Turnstile token is required",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the token is blank", async () => {
    const result = await verifyTurnstile({
      token: "   ",
      secretKey: "turnstile-secret",
      fetch: vi.fn(),
    });

    expect(result).toEqual({
      ok: false,
      status: 400,
      error: "Turnstile token is required",
    });
  });

  it("reads the captcha header from email auth requests", () => {
    const request = new Request("http://localhost/api/auth/sign-in/magic-link", {
      method: "POST",
      headers: { "x-captcha-response": "siteverify-token" },
    });

    expect(turnstileTokenFromRequest(request)).toBe("siteverify-token");
    expect(isEmailAuthPath("/api/auth/sign-in/magic-link")).toBe(true);
    expect(isEmailAuthPath("/api/auth/sign-in/social")).toBe(false);
  });
});
