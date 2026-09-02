import { describe, expect, it, vi } from "vitest";

import { applyUnlockResult, submitUnlockForm } from "./unlock-form";

const applyUrl = "https://studio.example/careers/secret-apply";

describe("submitUnlockForm", () => {
  it("posts the form to /api/unlock and consumes success JSON for a client redirect", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({ applyUrl, completeness: 20 }, { status: 200 }),
    );
    const form = new FormData();
    form.set("jobId", "job-1");
    form.set("next", "/jobs/gameplay-engineer");

    await expect(submitUnlockForm(form, fetchImpl)).resolves.toEqual({
      kind: "apply",
      applyUrl,
      completeness: 20,
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/unlock", {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    expect(fetchImpl.mock.calls[0]?.[1]).not.toHaveProperty("redirect");
  });

  it("follows JSON login and onboarding redirects from fetch without opaque-redirect", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({ redirect: "/login" }, { status: 401 }),
    );

    await expect(submitUnlockForm(new FormData(), fetchImpl)).resolves.toEqual({
      kind: "redirect",
      url: "/login",
    });
    expect(fetchImpl.mock.calls[0]?.[1]).not.toHaveProperty("redirect");
  });

  it("surfaces 402 quota without following a studio URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({ code: "quota" }, { status: 402 }),
    );

    await expect(submitUnlockForm(new FormData(), fetchImpl)).resolves.toEqual({
      kind: "quota",
    });
  });

  it("nudges when completeness is below 80 and redirects at 80", () => {
    expect(applyUnlockResult({ kind: "apply", applyUrl, completeness: 60 })).toEqual({
      action: "nudge",
      applyUrl,
      completeness: 60,
    });
    expect(applyUnlockResult({ kind: "apply", applyUrl, completeness: 80 })).toEqual({
      action: "redirect",
      applyUrl,
    });
  });
});
