import { describe, expect, it } from "vitest";

import {
  HUB_ROLE_SLUGS,
  isHubRoleSlug,
  parseRoleHubSegment,
} from "./hubs.ts";

describe("hub role allowlist", () => {
  it("contains the fixed role dictionary", () => {
    expect(HUB_ROLE_SLUGS).toEqual([
      "gameplay-programmer",
      "engine-programmer",
      "graphics-programmer",
      "tools-programmer",
      "technical-artist",
      "technical-designer",
      "game-designer",
      "narrative-designer",
      "producer",
      "qa",
      "live-ops",
      "community",
      "audio",
      "ui-ux",
      "unity",
      "unreal",
      "godot",
      "multiplayer",
    ]);
  });

  it("rejects unknown role and skill slugs", () => {
    expect(isHubRoleSlug("unity")).toBe(true);
    expect(isHubRoleSlug("accountant")).toBe(false);
  });

  it("parses only valid remote role URL segments", () => {
    expect(parseRoleHubSegment("remote-unity-jobs")).toBe("unity");
    expect(parseRoleHubSegment("remote-accountant-jobs")).toBeUndefined();
    expect(parseRoleHubSegment("unity")).toBeUndefined();
  });
});
