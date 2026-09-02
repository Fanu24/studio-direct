import { describe, expect, it } from "vitest";

import { consumeUnlockResponse } from "./client";

const applyUrl = "https://studio.example/careers/secret-apply";

describe("consumeUnlockResponse", () => {
  it("redirects the client to applyUrl on success JSON", async () => {
    const result = await consumeUnlockResponse(
      Response.json({ applyUrl }, { status: 200 }),
    );

    expect(result).toEqual({ kind: "apply", applyUrl });
  });

  it("shows quota on 402 without an applyUrl or studio redirect", async () => {
    const result = await consumeUnlockResponse(
      Response.json({ code: "quota" }, { status: 402 }),
    );

    expect(result).toEqual({ kind: "quota" });
    expect(JSON.stringify(result)).not.toContain(applyUrl);
  });

  it("follows login and onboarding 303 Location without leaking applyUrl", async () => {
    const login = await consumeUnlockResponse(
      new Response(null, {
        status: 303,
        headers: { location: "http://localhost/login" },
      }),
    );
    expect(login).toEqual({ kind: "redirect", url: "http://localhost/login" });

    const onboarding = await consumeUnlockResponse(
      new Response(null, {
        status: 303,
        headers: { location: "http://localhost/onboarding?next=%2Fjobs%2Fgameplay-engineer" },
      }),
    );
    expect(onboarding).toEqual({
      kind: "redirect",
      url: "http://localhost/onboarding?next=%2Fjobs%2Fgameplay-engineer",
    });
  });
});
