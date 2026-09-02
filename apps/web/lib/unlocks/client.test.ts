import { describe, expect, it } from "vitest";

import { consumeUnlockResponse } from "./client";

const applyUrl = "https://studio.example/careers/secret-apply";

describe("consumeUnlockResponse", () => {
  it("redirects the client to applyUrl on success JSON", async () => {
    const result = await consumeUnlockResponse(
      Response.json({ applyUrl, completeness: 40 }, { status: 200 }),
    );

    expect(result).toEqual({ kind: "apply", applyUrl, completeness: 40 });
  });

  it("passes completeness through so the client can nudge below 80", async () => {
    const result = await consumeUnlockResponse(
      Response.json({ applyUrl, completeness: 20 }, { status: 200 }),
    );

    expect(result).toEqual({ kind: "apply", applyUrl, completeness: 20 });
    expect(JSON.stringify(result)).not.toContain("apply_url");
  });

  it("shows quota on 402 without an applyUrl or studio redirect", async () => {
    const result = await consumeUnlockResponse(
      Response.json({ code: "quota" }, { status: 402 }),
    );

    expect(result).toEqual({ kind: "quota" });
    expect(JSON.stringify(result)).not.toContain(applyUrl);
  });

  it("follows login and onboarding JSON redirect without leaking applyUrl", async () => {
    const login = await consumeUnlockResponse(
      Response.json({ redirect: "/login" }, { status: 401 }),
    );
    expect(login).toEqual({ kind: "redirect", url: "/login" });
    expect(JSON.stringify(login)).not.toContain(applyUrl);

    const onboarding = await consumeUnlockResponse(
      Response.json(
        { redirect: "/onboarding?next=%2Fjobs%2Fgameplay-engineer" },
        { status: 403 },
      ),
    );
    expect(onboarding).toEqual({
      kind: "redirect",
      url: "/onboarding?next=%2Fjobs%2Fgameplay-engineer",
    });
    expect(JSON.stringify(onboarding)).not.toContain(applyUrl);
  });

  it("does not treat a 303 Location header as a browser-visible gate", async () => {
    const result = await consumeUnlockResponse(
      new Response(null, {
        status: 303,
        headers: { location: "/login" },
      }),
    );

    expect(result).toEqual({ kind: "error" });
  });
});
