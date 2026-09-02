import { describe, expect, it, vi } from "vitest";

import { submitUnlockForm } from "./unlock-form";

const applyUrl = "https://studio.example/careers/secret-apply";

describe("submitUnlockForm", () => {
  it("posts the form to /api/unlock and consumes success JSON for a client redirect", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({ applyUrl }, { status: 200 }),
    );
    const form = new FormData();
    form.set("jobId", "job-1");
    form.set("next", "/jobs/gameplay-engineer");

    await expect(submitUnlockForm(form, fetchImpl)).resolves.toEqual({
      kind: "apply",
      applyUrl,
    });
    expect(fetchImpl).toHaveBeenCalledWith("/api/unlock", {
      method: "POST",
      body: form,
      redirect: "manual",
      credentials: "same-origin",
    });
  });

  it("surfaces 402 quota without following a studio URL", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      Response.json({ code: "quota" }, { status: 402 }),
    );

    await expect(submitUnlockForm(new FormData(), fetchImpl)).resolves.toEqual({
      kind: "quota",
    });
  });
});
