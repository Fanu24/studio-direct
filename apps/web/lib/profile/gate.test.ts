import { describe, expect, it, vi } from "vitest";

import {
  loadOnboardingProfile,
  needsOnboarding,
  saveOnboardingProfile,
  unlockGateResponse,
} from "./gate";

describe("needsOnboarding", () => {
  it("is true when display_name, target_role, or remote_pref is missing", () => {
    expect(needsOnboarding(null)).toBe(true);
    expect(needsOnboarding(undefined)).toBe(true);
    expect(
      needsOnboarding({
        display_name: "Ada",
        target_role: "Gameplay Programmer",
        remote_pref: null,
      }),
    ).toBe(true);
    expect(
      needsOnboarding({
        display_name: "Ada",
        target_role: "  ",
        remote_pref: "remote",
      }),
    ).toBe(true);
    expect(
      needsOnboarding({
        display_name: "",
        target_role: "Gameplay Programmer",
        remote_pref: "hybrid",
      }),
    ).toBe(true);
  });

  it("is false when display_name, target_role, and remote_pref are filled", () => {
    expect(
      needsOnboarding({
        display_name: "Ada",
        target_role: "Gameplay Programmer",
        remote_pref: "remote",
      }),
    ).toBe(false);
  });
});

describe("unlockGateResponse", () => {
  const applyUrl = "https://studio.example/careers/secret-apply";

  function request() {
    return new Request("http://localhost/api/unlock", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        jobId: "job-1",
        next: "/jobs/gameplay-engineer",
      }),
    });
  }

  async function bodyAndLocation(response: Response) {
    return {
      status: response.status,
      location: response.headers.get("location"),
      body: await response.text(),
    };
  }

  it("sends unauthenticated unlocks to login without leaking apply_url", async () => {
    const response = unlockGateResponse({
      request: request(),
      sessionUserId: null,
      profile: null,
      next: "/jobs/gameplay-engineer",
      applyUrl,
    });

    const { status, location, body } = await bodyAndLocation(response!);

    expect(status).toBe(303);
    expect(location).toMatch(/\/login$/);
    expect(location).not.toContain(applyUrl);
    expect(body).not.toContain(applyUrl);
  });

  it("redirects users who need onboarding to /onboarding?next=", async () => {
    const response = unlockGateResponse({
      request: request(),
      sessionUserId: "user-1",
      profile: {
        display_name: "Ada",
        target_role: null,
        remote_pref: "remote",
      },
      next: "/jobs/gameplay-engineer",
      applyUrl,
    });

    const { status, location, body } = await bodyAndLocation(response!);
    const redirected = new URL(location!, "http://localhost");

    expect(status).toBe(303);
    expect(redirected.pathname).toBe("/onboarding");
    expect(redirected.searchParams.get("next")).toBe("/jobs/gameplay-engineer");
    expect(location).not.toContain(applyUrl);
    expect(body).not.toContain(applyUrl);
  });

  it("does not consume quota when the session user is already onboarded", () => {
    const response = unlockGateResponse({
      request: request(),
      sessionUserId: "user-1",
      profile: {
        display_name: "Ada",
        target_role: "Gameplay Programmer",
        remote_pref: "hybrid",
      },
      next: "/jobs/gameplay-engineer",
      applyUrl,
    });

    expect(response).toBeNull();
  });
});

describe("onboarding profile store", () => {
  it("loads display_name, target_role, and remote_pref for a user", async () => {
    const first = vi.fn().mockResolvedValue({
      display_name: "Ada",
      target_role: "Gameplay Programmer",
      remote_pref: "remote",
    });
    const bind = vi.fn(() => ({ first }));
    const prepare = vi.fn(() => ({ bind }));

    await expect(loadOnboardingProfile({ prepare }, "user-1")).resolves.toEqual({
      display_name: "Ada",
      target_role: "Gameplay Programmer",
      remote_pref: "remote",
    });
    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/from profiles/i));
    expect(bind).toHaveBeenCalledWith("user-1");
  });

  it("upserts the three onboarding fields without opting into the talent pool", async () => {
    const run = vi.fn().mockResolvedValue({ success: true });
    const bind = vi.fn(() => ({ run }));
    const prepare = vi.fn(() => ({ bind }));

    await saveOnboardingProfile(
      { prepare },
      "user-1",
      {
        display_name: "Ada",
        target_role: "Gameplay Programmer",
        remote_pref: "hybrid",
      },
    );

    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/insert into profiles/i));
    expect(prepare).toHaveBeenCalledWith(expect.stringMatching(/on conflict\(user_id\)/i));
    expect(prepare).not.toHaveBeenCalledWith(expect.stringMatching(/talent_pool_opt_in\s*=\s*1/i));
    expect(bind).toHaveBeenCalledWith(
      "user-1",
      "Ada",
      "Gameplay Programmer",
      "hybrid",
    );
    expect(run).toHaveBeenCalledTimes(1);
  });
});
