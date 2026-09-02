import { describe, expect, it } from "vitest";

import { showBadge } from "./exclusivity";
import { buildJobPostingJsonLd } from "./jsonld";

describe("buildJobPostingJsonLd", () => {
  it("uses the public job URL without exposing the locked application URL", () => {
    const result = buildJobPostingJsonLd(
      {
        slug: "senior-gameplay-engineer",
        title: "Senior Gameplay Engineer",
        descriptionHtml: "<p>Build combat systems for our unannounced game.</p>",
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
        companyName: "Example Studio",
      },
      "https://jobs.example.com/",
    );

    expect(result.description).toBe(descriptionHtml);
  });

  it("strips executable markup from the job description", () => {
    const result = buildJobPostingJsonLd(
      {
        slug: "security-engineer",
        title: "Security Engineer",
        descriptionHtml:
          '<h2>The role</h2><script>alert("xss")</script><p><img src="x" onerror="alert(1)">Keep this text.</p>',
        companyName: "Example Studio",
      },
      "https://jobs.example.com",
    );

    expect(result.description).toContain("<h2>The role</h2>");
    expect(result.description).toContain("Keep this text.");
    expect(result.description).not.toContain("<script");
    expect(result.description).not.toContain("onerror");
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
