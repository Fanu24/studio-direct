import {
  REGIONS,
  isJobTag,
  isNonTechSalaryRole,
  isSalaryRole,
  parseLandingSegment,
} from "@gaming/shared";
import { describe, expect, it } from "vitest";

import { isLearnCategory } from "../learn-web3/categories";
import { FOOTER_COLUMNS, FOOTER_GROUPS } from "./footer-data";

const STATIC_PAGES = new Set([
  "/jobs",
  "/intern-jobs",
  "/web3-companies",
  "/highest-paying-web3-jobs",
  "/top-web3-jobs",
  "/highest-paid-non-tech-jobs",
  "/web3-companies/top-growing",
  "/web3-salaries/solana-vs-ethereum",
  "/about",
  "/faq",
  "/what-is-web3",
  "/post-web3-job",
  "/pricing",
  "/ads",
  "/crypto-events",
  "/web3-jobs-api",
  "/legal",
  "/terms",
  "/privacy",
  "/login",
]);

function segment(href: string): string {
  return href.replace(/^\//, "");
}

function lastSegment(href: string): string {
  const parts = href.split("/");
  return parts[parts.length - 1] ?? "";
}

/** Every group's hrefs are checked against the taxonomy guard that route actually enforces. */
function hrefIsLive(heading: string, href: string): boolean {
  switch (heading) {
    case "Developer Salaries":
      return isSalaryRole(lastSegment(href));
    case "Non-Tech Salaries":
      return isNonTechSalaryRole(lastSegment(href));
    case "Learn Web3":
      return isLearnCategory(lastSegment(href));
    case "Hire Web3 Talent":
      return isJobTag(lastSegment(href));
    case "More":
      return STATIC_PAGES.has(href);
    default:
      // Remote Web3 Jobs, Remote Non-Tech Jobs, Top Web3 Cities, Regions, Benefits all
      // resolve through the same [slug] catch-all the site serves them from.
      return parseLandingSegment(segment(href)) !== null;
  }
}

describe("FOOTER_GROUPS", () => {
  it("has no empty groups", () => {
    expect(FOOTER_GROUPS.length).toBeGreaterThan(0);
    for (const group of FOOTER_GROUPS) {
      expect(group.links.length, group.heading).toBeGreaterThan(0);
    }
  });

  it("has no duplicate hrefs within a group", () => {
    for (const group of FOOTER_GROUPS) {
      const hrefs = group.links.map((link) => link.href);
      expect(new Set(hrefs).size, group.heading).toBe(hrefs.length);
    }
  });

  it("Benefits has exactly 21 entries", () => {
    const benefits = FOOTER_GROUPS.find((group) => group.heading === "Benefits");
    expect(benefits?.links).toHaveLength(21);
  });

  it("every generated href passes its taxonomy guard", () => {
    for (const group of FOOTER_GROUPS) {
      for (const link of group.links) {
        expect(hrefIsLive(group.heading, link.href), `${group.heading}: ${link.href}`).toBe(
          true,
        );
      }
    }
  });
});

/**
 * Routes the footer's third column and its hub column reach through a real page
 * directory rather than through the [slug] landing catch-all. Kept explicit so a
 * renamed route trips this test instead of shipping a 404 into every page's footer.
 */
const FOOTER_STATIC_PAGES = new Set([
  "/web3-salaries",
  "/web3-non-tech-salaries",
  "/web3-cities",
  "/learn-web3",
  "/hire",
  "/what-is-web3",
  "/faq",
  "/web3-companies",
  "/jobs",
  "/about",
  "/ads",
  "/crypto-events",
  "/web3-jobs-api",
  "/pricing",
  "/terms",
  "/privacy",
  "/legal",
  "/login",
  "/login?intent=start",
]);

describe("FOOTER_COLUMNS", () => {
  it("is the reference three-column footer: hubs, regions, long tail", () => {
    expect(FOOTER_COLUMNS.map((column) => column.heading)).toEqual([
      "Browse",
      "Regions",
      "Other",
    ]);
  });

  it("opens with the job, salary, city, learn and hire hubs", () => {
    const browse = FOOTER_COLUMNS[0]!;
    expect(browse.links.map((link) => link.href)).toEqual([
      "/remote-jobs",
      "/remote-non-tech-jobs",
      "/web3-salaries",
      "/web3-non-tech-salaries",
      "/web3-cities",
      "/learn-web3",
      "/hire",
    ]);
  });

  it("lists every region we serve, exactly once", () => {
    const regions = FOOTER_COLUMNS.find((column) => column.heading === "Regions");
    expect(regions?.links.map((link) => link.href)).toEqual(
      REGIONS.map((region) => `/web3-jobs-${region}`),
    );
  });

  it("closes the long tail on the account links", () => {
    const other = FOOTER_COLUMNS.find((column) => column.heading === "Other");
    expect(other?.links.slice(-2).map((link) => link.href)).toEqual([
      "/login",
      "/login?intent=start",
    ]);
  });

  it("links no href twice anywhere in the footer", () => {
    const hrefs = FOOTER_COLUMNS.flatMap((column) => column.links.map((link) => link.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("links only internal routes that exist", () => {
    for (const column of FOOTER_COLUMNS) {
      for (const link of column.links) {
        expect(link.href.startsWith("/"), link.href).toBe(true);
        expect(link.label.trim().length, link.href).toBeGreaterThan(0);

        const live =
          FOOTER_STATIC_PAGES.has(link.href) || parseLandingSegment(segment(link.href)) !== null;
        expect(live, `${column.heading}: ${link.href}`).toBe(true);
      }
    }
  });
});
