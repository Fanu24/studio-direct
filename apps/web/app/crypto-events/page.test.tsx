import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { CRYPTO_EVENTS } from "./events";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

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
  return text((node as ReactElement<{ children?: ReactNode }>).props.children);
}

describe("CryptoEventsPage", () => {
  it("groups events by region and lists every event from the dataset", async () => {
    const { default: CryptoEventsPage } = await import("./page");
    const page = CryptoEventsPage();
    const copy = text(page);
    const h1 = elements(page).find((element) => element.type === "h1");

    expect(text(h1)).toBe("Web3 and crypto industry events");
    for (const event of CRYPTO_EVENTS) {
      expect(copy).toContain(event.name);
    }
    expect(copy).toContain("North America");
    expect(copy).toContain("Europe");
  });

  it("links each event to its official site and cross-links stable host cities", async () => {
    const { default: CryptoEventsPage } = await import("./page");
    const page = CryptoEventsPage();
    const hrefs = elements(page).map((element) => element.props.href).filter(Boolean);

    for (const event of CRYPTO_EVENTS) {
      expect(hrefs).toContain(event.url);
    }
    expect(hrefs).toContain("/web3-jobs-denver");
    expect(hrefs).toContain("/web3-jobs-singapore");
    expect(hrefs).toContain("/jobs");
  });

  it("does not fabricate exact 2026 dates and says the schedule is indicative", async () => {
    const { default: CryptoEventsPage } = await import("./page");
    const page = CryptoEventsPage();
    const copy = text(page);

    expect(copy.toLowerCase()).toContain("indicative");
    expect(copy).not.toMatch(
      /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s*2026\b/i,
    );
  });

  it("carries ItemList JSON-LD for every event", async () => {
    const { default: CryptoEventsPage } = await import("./page");
    const page = CryptoEventsPage();
    const jsonLd = elements(page)
      .map((element) => element.props.data as { "@type"?: string; numberOfItems?: number } | undefined)
      .find((data) => data?.["@type"] === "ItemList");

    expect(jsonLd?.numberOfItems).toBe(CRYPTO_EVENTS.length);
  });
});
