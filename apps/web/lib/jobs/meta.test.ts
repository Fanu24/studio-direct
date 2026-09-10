import { describe, expect, it } from "vitest";

import {
  buildJobTitle,
  buildMetaDescription,
  clampWords,
  decodeEntities,
  firstSentence,
} from "./meta";

describe("decodeEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("Ships &amp; salt &lt;3&gt;")).toBe("Ships & salt <3>");
    expect(decodeEntities("caf&#233;")).toBe("café");
    expect(decodeEntities("caf&#xe9;")).toBe("café");
  });

  it("leaves unknown entities untouched", () => {
    expect(decodeEntities("A&weird;B")).toBe("A&weird;B");
  });
});

describe("firstSentence", () => {
  it("skips headings and short label-like blocks", () => {
    const html =
      "<h2>About the role</h2><p>Short.</p><p>Lead the combat team on a live multiplayer title and own the feel of every weapon. Then a second sentence.</p>";
    expect(firstSentence(html)).toBe(
      "Lead the combat team on a live multiplayer title and own the feel of every weapon.",
    );
  });

  it("falls back to the first block when nothing clears the length floor", () => {
    expect(firstSentence("<p>Ship it.</p>")).toBe("Ship it.");
  });
});

describe("clampWords", () => {
  it("cuts on the last word boundary at or before the limit", () => {
    expect(clampWords("Ship contracts across three squads", 12)).toBe("Ship");
    expect(clampWords("short", 20)).toBe("short");
  });
});

describe("buildMetaDescription", () => {
  it("leads with where and pay, then the opening sentence", () => {
    const description = buildMetaDescription({
      title: "Gameplay Engineer",
      companyName: "Alpha Studio",
      where: "Remote, London",
      salaryText: null,
      descriptionHtml: "<p>Build combat systems.</p>",
    });
    expect(description).toBe(
      "Gameplay Engineer at Alpha Studio. Remote, London. Build combat systems.",
    );
  });

  it("includes salary when present and stays under the SERP limit", () => {
    const description = buildMetaDescription({
      title: "Gameplay Engineer",
      companyName: "Alpha Studio",
      where: "Hybrid, London",
      salaryText: "$160k - $220k",
      descriptionHtml:
        "<h2>About the role</h2><p>Lead the combat team on a live multiplayer title, own the "
        + "feel of every weapon and ability, and mentor three engineers across two time zones. "
        + "Then a second sentence.</p>",
    });
    expect(description.startsWith(
      "Gameplay Engineer at Alpha Studio. Hybrid, London. $160k - $220k. Lead the combat team",
    )).toBe(true);
    expect(description).not.toContain("About the role");
    expect(description.length).toBeLessThan(160);
  });
});

describe("buildJobTitle", () => {
  it("adds salary and place modifiers when both are known", () => {
    expect(
      buildJobTitle({
        title: "Solidity Engineer",
        companyName: "Alpha Studio",
        place: "London",
        salaryText: "$120k - $160k",
      }),
    ).toBe("Solidity Engineer $120k - $160k in London at Alpha Studio");
  });

  it("drops the pay segment when salary is unknown", () => {
    expect(
      buildJobTitle({
        title: "Solidity Engineer",
        companyName: "Alpha Studio",
        place: "Remote",
        salaryText: null,
      }),
    ).toBe("Solidity Engineer in Remote at Alpha Studio");
  });

  it("falls back to title at company when place is unknown", () => {
    expect(
      buildJobTitle({
        title: "Solidity Engineer",
        companyName: "Alpha Studio",
        place: "",
        salaryText: null,
      }),
    ).toBe("Solidity Engineer at Alpha Studio");
  });
});
