import { describe, expect, it } from "vitest";

import { showBadge } from "./exclusivity";
import { buildJobPostingJsonLd } from "./jsonld";

describe("buildJobPostingJsonLd", () => {
  it("uses the public job URL and preferred application URL", () => {
    const result = buildJobPostingJsonLd(
      {
        slug: "senior-gameplay-engineer",
        title: "Senior Gameplay Engineer",
        descriptionHtml: "<p>Build combat systems for our unannounced game.</p>",
        applyUrl: "https://studio.example/careers/123",
        companyName: "Example Studio",
      },
      "https://jobs.example.com",
    );

    expect(result).toEqual({
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Senior Gameplay Engineer",
      description: "<p>Build combat systems for our unannounced game.</p>",
      url: "https://jobs.example.com/jobs/senior-gameplay-engineer",
      hiringOrganization: {
        "@type": "Organization",
        name: "Example Studio",
      },
      directApply: {
        "@type": "ApplyAction",
        target: "https://studio.example/careers/123",
      },
    });
  });

  it("keeps the complete HTML job description", () => {
    const descriptionHtml =
      "<h2>The role</h2><p>Public first paragraph.</p><p>Full responsibilities.</p>";

    const result = buildJobPostingJsonLd(
      {
        slug: "technical-artist",
        title: "Technical Artist",
        descriptionHtml,
        applyUrl: "https://studio.example/jobs/artist",
        companyName: "Example Studio",
      },
      "https://jobs.example.com/",
    );

    expect(result.description).toBe(descriptionHtml);
  });
});

describe("showBadge", () => {
  it("shows the badge only for confirmed hidden-from-LinkedIn jobs", () => {
    expect(showBadge("hidden_from_linkedin")).toBe(true);
    expect(showBadge("unknown")).toBe(false);
    expect(showBadge("on_boards")).toBe(false);
    expect(showBadge("seen_on_linkedin")).toBe(false);
  });
});
