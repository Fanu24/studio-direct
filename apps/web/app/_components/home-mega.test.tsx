import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  HOME_FAQ_QUESTIONS,
  HomeCareerFaq,
  HomeMegaLinks,
  HomeReviews,
  ProfileBanner,
  homeCareerFaq,
} from "./home-mega";
import { TagChips } from "./tag-chips";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => React.createElement("a", props),
}));

vi.stubGlobal("React", React);

function elements(node: ReactNode): TestElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as TestElement;
  return [element, ...elements(element.props.children)];
}

function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  return text((node as TestElement).props.children);
}

describe("home mega chrome", () => {
  it("lists competitor-style hubs without competitor brands", () => {
    const tree = HomeMegaLinks();
    const hrefs = elements(tree)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);
    const copy = text(tree);

    expect(copy).toContain("Remote Web3 Jobs");
    expect(copy).toContain("Web3 Developer Salaries");
    expect(copy).toContain("Top Web3 Cities");
    expect(copy).toContain("Hire Web3 Developers");
    expect(copy).toContain("Benefits");
    expect(hrefs).toContain("/remote+solidity-jobs");
    expect(hrefs).toContain("/web3-jobs-new-york");
    expect(hrefs).toContain("/hire/rust");
    expect(hrefs).toContain("/learn-web3/article");
    expect(copy).not.toMatch(/Bondex|wagmi|WxRK/i);
    expect(copy).not.toMatch(/[–—]/);
  });

  it("renders a Nodework profile banner and an honestly labelled review carousel", () => {
    const banner = ProfileBanner();
    const reviews = HomeReviews();
    const faq = HomeCareerFaq({ jobCount: 12 });

    expect(text(banner)).toContain("Stop applying. Get discovered by hiring teams.");
    expect(elements(banner).some((el) => el.props.href === "/onboarding")).toBe(true);
    expect(text(reviews)).toContain("How people use Nodework");
    expect(text(reviews)).toContain("Illustrative examples written by us");
    // No invented testimonials: we have collected no customer reviews, so no
    // card may carry a "Name, Job Title" attribution.
    expect(text(reviews)).not.toMatch(/[A-Z][a-z]+, (?:Full Stack|Senior|Lead|Head) /);
    expect(text(faq)).not.toMatch(/Bondex|wagmi|WxRK/i);
    expect(`${text(banner)}${text(reviews)}${text(faq)}`).not.toMatch(/[–—]/);
  });

  it("drives the review carousel from radios with per-slide Previous/Next labels", () => {
    const reviews = HomeReviews();
    const nodes = elements(reviews);
    const radios = nodes.filter(
      (el) => el.type === "input" && el.props.type === "radio",
    );
    const labelTargets = nodes
      .filter((el) => el.type === "label")
      .map((el) => el.props.htmlFor as string);

    expect(radios).toHaveLength(3);
    expect(radios.filter((el) => el.props.defaultChecked === true)).toHaveLength(1);
    expect(radios.every((el) => el.props.name === "home-review")).toBe(true);
    expect(text(reviews)).toContain("Previous");
    expect(text(reviews)).toContain("Next");
    expect(text(reviews)).toContain("1 / 3");
    // Every Previous/Next label points at a radio that exists, so the pure-CSS
    // carousel cannot dead-end on a missing id.
    const ids = new Set(radios.map((el) => el.props.id as string));
    expect(labelTargets).toHaveLength(6);
    expect(labelTargets.every((target) => ids.has(target))).toBe(true);
  });

  it("ends on six FAQ entries, each an h2 inside its own disclosure", () => {
    const faq = HomeCareerFaq({ jobCount: 12 });
    const nodes = elements(faq);
    const details = nodes.filter((el) => el.type === "details");
    const headings = nodes.filter((el) => el.type === "h2");

    expect(HOME_FAQ_QUESTIONS).toHaveLength(6);
    expect(homeCareerFaq(12)).toHaveLength(6);
    expect(details).toHaveLength(6);
    expect(headings).toHaveLength(6);
    expect(headings.map((el) => text(el))).toEqual([...HOME_FAQ_QUESTIONS]);
    expect(text(faq)).toContain("Is a Web3 career legit?");
  });

  it("carries the reference link inventory in every browse section", () => {
    const tree = HomeMegaLinks();
    const sections = elements(tree).filter((el) => el.type === "section");
    const sizes = new Map(
      sections.map((section) => {
        const heading = elements(section).find((el) => el.type === "h2");
        const hrefs = elements(section).filter(
          (el) => typeof el.props.href === "string",
        );
        return [text(heading), hrefs.length] as const;
      }),
    );

    // Sizes measured off the reference board's homepage sections.
    expect(sizes.get("Remote Web3 Jobs")).toBeGreaterThanOrEqual(19);
    expect(sizes.get("Remote Non-Tech Web3 Jobs")).toBeGreaterThanOrEqual(11);
    expect(sizes.get("Web3 Developer Salaries")).toBeGreaterThanOrEqual(37);
    expect(sizes.get("Web3 Non-Tech Salaries")).toBeGreaterThanOrEqual(14);
    expect(sizes.get("Top Web3 Cities")).toBeGreaterThanOrEqual(20);
    expect(sizes.get("Top Regions for Web3 Careers")).toBeGreaterThanOrEqual(6);

    const hrefs = elements(tree)
      .filter((el) => typeof el.props.href === "string")
      .map((el) => el.props.href as string);
    expect(hrefs).toContain("/customer-support+remote-jobs");
    expect(hrefs).toContain("/remote+tech-lead-jobs");
    expect(hrefs).toContain("/dev+entry-level+remote-jobs");
    expect(hrefs).toContain("/entry-level+non-tech+remote-jobs");
    // href doubles as the React key inside a section, so no section may repeat one.
    for (const section of sections) {
      const inSection = elements(section)
        .filter((el) => typeof el.props.href === "string")
        .map((el) => el.props.href as string);
      expect(new Set(inSection).size).toBe(inSection.length);
    }
  });

  it("keeps compact chips with a show more control and extra tags in the DOM", () => {
    const tree = TagChips({});
    const hrefs = elements(tree)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);
    const copy = text(tree);

    expect(copy).toContain("Show more");
    expect(copy).toContain("Show less");
    expect(hrefs).toContain("/community-manager-jobs");
    expect(hrefs).toContain("/solidity-jobs");
  });
});
