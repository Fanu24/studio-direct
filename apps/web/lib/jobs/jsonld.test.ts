import { describe, expect, it } from "vitest";

import { showBadge } from "./exclusivity";
import { buildJobPostingJsonLd } from "./jsonld";

describe("buildJobPostingJsonLd", () => {
  it("uses the public job URL and never publishes the gated apply URL", () => {
    const result = buildJobPostingJsonLd(
      {
        slug: "senior-gameplay-engineer",
        externalId: "42",
        title: "Senior Gameplay Engineer",
        descriptionHtml: "<p>Build combat systems for our unannounced game.</p>",
        companyName: "Example Studio",
      },
      "https://jobs.example.com",
    );

    expect(result.url).toBe("https://jobs.example.com/senior-gameplay-engineer/42");
    expect(result.directApply).toBe(true);
    expect(result.potentialAction).toEqual({
      "@type": "ApplyAction",
      target: "https://jobs.example.com/senior-gameplay-engineer/42/apply",
    });
    expect(JSON.stringify(result)).not.toContain("applyUrl");
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

  it("emits datePosted, validThrough and the hiring organization logo", () => {
    const result = buildJobPostingJsonLd(
      {
        slug: "senior-gameplay-engineer",
        externalId: "42",
        title: "Senior Gameplay Engineer",
        descriptionHtml: "<p>Build combat systems.</p>",
        companyName: "Example Studio",
        postedAt: "2026-08-01T00:00:00.000Z",
        companyLogoUrl: "https://cdn.example.com/logo.png",
      },
      "https://jobs.example.com",
    );

    expect(result.datePosted).toBe("2026-08-01T00:00:00.000Z");
    expect(result.validThrough).toBe("2026-09-30T00:00:00.000Z");
    expect(result.hiringOrganization).toEqual({
      "@type": "Organization",
      name: "Example Studio",
      logo: "https://cdn.example.com/logo.png",
    });
  });

  it("omits datePosted and validThrough when postedAt is unknown", () => {
    const result = buildJobPostingJsonLd(
      {
        slug: "senior-gameplay-engineer",
        title: "Senior Gameplay Engineer",
        descriptionHtml: "<p>Build combat systems.</p>",
        companyName: "Example Studio",
      },
      "https://jobs.example.com",
    );

    expect(result).not.toHaveProperty("datePosted");
    expect(result).not.toHaveProperty("validThrough");
  });

  it("marks remote roles TELECOMMUTE with applicantLocationRequirements", () => {
    const result = buildJobPostingJsonLd(
      {
        slug: "remote-solidity-engineer",
        title: "Solidity Engineer",
        descriptionHtml: "<p>Ship contracts.</p>",
        companyName: "Example Studio",
        remote: "remote",
        location: null,
      },
      "https://jobs.example.com",
    );

    expect(result.jobLocationType).toBe("TELECOMMUTE");
    expect(result.applicantLocationRequirements).toEqual({
      "@type": "Country",
      name: "Worldwide",
    });
    expect(result).not.toHaveProperty("jobLocation");
  });

  it("emits a PostalAddress jobLocation for a known city", () => {
    const result = buildJobPostingJsonLd(
      {
        slug: "onsite-technical-artist",
        title: "Technical Artist",
        descriptionHtml: "<p>Ship worlds.</p>",
        companyName: "Example Studio",
        remote: "onsite",
        location: "Berlin, Germany",
      },
      "https://jobs.example.com",
    );

    expect(result.jobLocation).toEqual({
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: "Berlin, Germany" },
    });
    expect(result).not.toHaveProperty("jobLocationType");
  });

  it("emits baseSalary only when a real numeric range exists", () => {
    const withSalary = buildJobPostingJsonLd(
      {
        slug: "solidity-engineer",
        title: "Solidity Engineer",
        descriptionHtml: "<p>Ship contracts.</p>",
        companyName: "Example Studio",
        salaryMin: 120_000,
        salaryMax: 160_000,
      },
      "https://jobs.example.com",
    );
    expect(withSalary.baseSalary).toEqual({
      "@type": "MonetaryAmount",
      currency: "USD",
      value: { "@type": "QuantitativeValue", unitText: "YEAR", minValue: 120_000, maxValue: 160_000 },
    });

    const withoutSalary = buildJobPostingJsonLd(
      {
        slug: "solidity-engineer",
        title: "Solidity Engineer",
        descriptionHtml: "<p>Ship contracts.</p>",
        companyName: "Example Studio",
        salaryText: "Competitive",
      },
      "https://jobs.example.com",
    );
    expect(withoutSalary).not.toHaveProperty("baseSalary");
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
