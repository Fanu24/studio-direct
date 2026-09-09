import { isJobTag } from "@gaming/shared";
import { describe, expect, it } from "vitest";

import { HIRE_TAGS, hireGroups } from "./tags";

/**
 * The seven slugs the reference hire index carries that the Nodework hub used
 * to leave unlinked (every one of them curl-verified 200 on /hire/{slug} before
 * landing here). Kept as an explicit list so a taxonomy pass that drops one is
 * a failing test rather than a quietly shrinking hub.
 */
const PARITY_ADDITIONS = [
  "event-manager",
  "game-dev",
  "men-in-web3",
  "others-in-web3",
  "ton-developer",
  "web3",
  "women-in-web3",
];

describe("HIRE_TAGS", () => {
  it("only lists slugs /hire/[skill] can actually render", () => {
    for (const slug of HIRE_TAGS) {
      expect(isJobTag(slug), `${slug} is not a job tag`).toBe(true);
    }
  });

  it("carries the hire slugs the reference index links", () => {
    for (const slug of PARITY_ADDITIONS) {
      expect(HIRE_TAGS).toContain(slug);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(HIRE_TAGS).size).toBe(HIRE_TAGS.length);
  });
});

describe("hireGroups", () => {
  it("places every hire tag in exactly one band", () => {
    const groups = hireGroups();
    const placed = groups.flatMap((group) => group.slugs);

    expect(new Set(placed).size).toBe(placed.length);
    expect([...placed].sort()).toEqual([...HIRE_TAGS].sort());
  });

  it("keeps the named bands and drops empty ones", () => {
    const labels = hireGroups().map((group) => group.label);

    expect(labels).toContain("Web3 developers");
    expect(labels).toContain("Other developers");
    expect(labels).toContain("AI engineers");
    expect(labels).toContain("Other tech");
    expect(labels).toContain("Non-tech");
    expect(labels).toContain("People in Web3");
    expect(hireGroups().every((group) => group.slugs.length > 0)).toBe(true);
  });

  it("routes an unnamed tag into the catch-all band rather than dropping it", () => {
    const groups = hireGroups(["solidity", "moderator", "bitcoin"]);
    const placed = groups.flatMap((group) => group.slugs);

    expect(placed).toContain("bitcoin");
    expect(groups.find((group) => group.key === "more")?.slugs).toContain("bitcoin");
  });
});
