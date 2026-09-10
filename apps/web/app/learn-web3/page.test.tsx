import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { ArticleLayout } from "../_components/article-layout";
import {
  LEARN_CATALOG_LINKS,
  LEARN_CATEGORIES,
  LEARN_FORMATS,
  LEARN_LEVELS,
  LEARN_TOPICS,
  isLearnTopic,
} from "./categories";
import {
  LEARN_CAREER_LANES,
  LEARN_COPY,
  LEARN_HUB_FAQ,
  LEARN_HUB_PARAGRAPHS,
  learnWordCount,
} from "./copy";

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
  if (Array.isArray(node)) return node.map(text).join("");
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  return text((node as TestElement).props.children);
}

function layoutTree(page: ReactNode) {
  const layout = elements(page).find((element) => element.type === ArticleLayout);
  return ArticleLayout(
    layout?.props as React.ComponentProps<typeof ArticleLayout>,
  );
}

describe("LearnWeb3HubPage", () => {
  it("uses original copy and links catalog tags plus every category", async () => {
    const { default: LearnWeb3HubPage } = await import("./page");
    const page = LearnWeb3HubPage();
    const tree = layoutTree(page);
    const copy = `${text(page)} ${text(tree)}`;
    const hrefs = [...elements(page), ...elements(tree)]
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(text(elements(tree).find((element) => element.type === "h1"))).toBe(
      "Learn Web3",
    );
    expect(learnWordCount(LEARN_HUB_PARAGRAPHS)).toBeGreaterThanOrEqual(400);
    expect(copy).toContain("We do not scrape");
    expect(copy).not.toMatch(/[–—]/);
    expect(hrefs).toContain("/solidity-jobs");
    expect(hrefs).toContain("/solana-jobs");
    expect(hrefs).toContain("/intern-jobs");
    for (const slug of LEARN_CATEGORIES) {
      expect(hrefs).toContain(`/learn-web3/${slug}`);
    }
    for (const link of LEARN_CATALOG_LINKS) {
      expect(hrefs).toContain(link.href);
    }
    // Facet pill bar reaches every format/level/topic slug that used to 404.
    for (const slug of [
      "solidity",
      "rust",
      "nft",
      "defi",
      "dao",
      "ethereum",
      "zero-knowledge",
    ]) {
      expect(hrefs).toContain(`/learn-web3/${slug}`);
    }
  });

  it("closes with the career lanes and an original FAQ, both linked from the TOC", async () => {
    const { default: LearnWeb3HubPage } = await import("./page");
    const page = LearnWeb3HubPage();
    const tree = layoutTree(page);
    const copy = `${text(page)} ${text(tree)}`;
    const hrefs = [...elements(page), ...elements(tree)]
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(copy).toContain("Start your Web3 career");
    expect(hrefs).toContain("#career");
    expect(hrefs).toContain("#faq");

    for (const lane of LEARN_CAREER_LANES) {
      expect(copy).toContain(lane.heading);
      for (const link of lane.links) {
        expect(hrefs, `${lane.key} -> ${link.href}`).toContain(link.href);
      }
    }
    for (const item of LEARN_HUB_FAQ) {
      expect(copy).toContain(item.question);
    }
    expect(copy).not.toMatch(/[–—]/);
  });

  it("puts every FAQ question in the page outline instead of hiding it in a dt", async () => {
    const { default: LearnWeb3HubPage } = await import("./page");
    const page = LearnWeb3HubPage();
    const tree = layoutTree(page);
    const all = [...elements(page), ...elements(tree)];

    // HTML forbids heading content inside a <dt>, so the questions can only be
    // headings if the list is not a <dl>. Guard both halves of that trade.
    expect(all.filter((element) => element.type === "dt")).toHaveLength(0);
    expect(all.filter((element) => element.type === "dl")).toHaveLength(0);

    // `all` double-counts the children, which appear both as ArticleLayout
    // props and in its rendered output - count them in the rendered tree only.
    const questionHeadings = elements(tree).filter(
      (element) =>
        element.type === "h2" &&
        LEARN_HUB_FAQ.some((item) => item.question === text(element)),
    );
    expect(questionHeadings).toHaveLength(LEARN_HUB_FAQ.length);

    // Every question must carry the reset that keeps it looking like the term
    // it replaced - a bare h2 here would render at display size.
    for (const heading of questionHeadings) {
      const style = heading.props.style as Record<string, unknown>;
      expect(style).toMatchObject({ fontSize: "1.05rem", fontWeight: 600 });
    }
  });

  it("emits FAQPage JSON-LD for the hub questions", async () => {
    const { default: LearnWeb3HubPage } = await import("./page");
    const page = LearnWeb3HubPage();
    const faq = elements(page)
      .map(
        (element) =>
          element.props.data as { "@type"?: string; mainEntity?: unknown[] } | undefined,
      )
      .find((data) => data?.["@type"] === "FAQPage");

    expect(faq?.mainEntity).toHaveLength(LEARN_HUB_FAQ.length);
  });
});

describe("learn copy", () => {
  it("keeps every format and level category original and long enough", () => {
    for (const slug of [...LEARN_FORMATS, ...LEARN_LEVELS, "all" as const]) {
      const words = learnWordCount(LEARN_COPY[slug].paragraphs);
      expect(words, slug).toBeGreaterThanOrEqual(380);
      expect(LEARN_COPY[slug].paragraphs.join(" ")).not.toMatch(/[–—]/);
    }
  });

  it("gives every topic slug a real, original intro", () => {
    for (const slug of LEARN_TOPICS) {
      expect(isLearnTopic(slug)).toBe(true);
      const words = learnWordCount(LEARN_COPY[slug].paragraphs);
      expect(words, slug).toBeGreaterThanOrEqual(50);
      expect(LEARN_COPY[slug].paragraphs.join(" ")).not.toMatch(/[–—]/);
    }
  });

  it("never duplicates a title or description across the whole vocabulary", () => {
    const titles = LEARN_CATEGORIES.map((slug) => LEARN_COPY[slug].title);
    const descriptions = LEARN_CATEGORIES.map((slug) => LEARN_COPY[slug].description);
    expect(new Set(titles).size).toBe(titles.length);
    expect(new Set(descriptions).size).toBe(descriptions.length);
  });
});
