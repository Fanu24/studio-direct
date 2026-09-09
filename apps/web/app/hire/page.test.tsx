import { FEATURED_TAG_CHIPS, tagLabel } from "@gaming/shared";
import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => React.createElement("a", props),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../../lib/tenant", () => ({
  requireTenantId: async () => "tenant-gaming",
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

// A single fake db.prepare(sql) that answers the hub's two bulk queries
// (counts, then a shared preview scan) - the hub is deliberately built on
// exactly these two round trips instead of one query per tag, see page.tsx.
function fakeDb() {
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn(() => ({
        all: vi.fn(async () => {
          if (sql.includes("GROUP BY jt.tag_slug")) {
            return { results: [{ slug: "solidity", jobCount: 6 }] };
          }
          return {
            results: [
              { slug: "solidity", id: "sol-1", title: "Solidity Engineer", companyName: "Alpha Studio" },
              { slug: "solidity", id: "sol-2", title: "Smart Contract Dev", companyName: "Beta Forge" },
            ],
          };
        }),
      })),
    })),
  };
}

describe("HireHubPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: fakeDb() } });
  });

  it("explains catalog hiring and links every skill with a live count", async () => {
    const { default: HireHubPage } = await import("./page");
    const page = await HireHubPage();
    const copy = text(page);
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(text(elements(page).find((element) => element.type === "h1"))).toBe(
      "Hire from the Nodework catalog",
    );
    expect(copy).toContain("Companies hiring");
    expect(copy).not.toMatch(/[–—]/);
    expect(hrefs).toContain("/web3-companies");
    expect(hrefs.some((href) => href === "/talent" || href.startsWith("/talent/"))).toBe(
      false,
    );

    for (const slug of FEATURED_TAG_CHIPS) {
      expect(hrefs).toContain(`/hire/${slug}`);
      expect(copy).toContain(tagLabel(slug));
    }

    // A confirmed-200 skill that FEATURED_TAG_CHIPS itself omits (P15 task 5).
    expect(hrefs).toContain("/hire/python");
    expect(copy).toContain(tagLabel("python"));

    // Structural parity with the reference hire index: the seven slugs it
    // links that this hub used to leave unreachable except by typed URL.
    for (const slug of [
      "event-manager",
      "game-dev",
      "men-in-web3",
      "others-in-web3",
      "ton-developer",
      "web3",
      "women-in-web3",
    ]) {
      expect(hrefs).toContain(`/hire/${slug}`);
    }

    // Live counts and a preview of real roles, not an invented number.
    expect(copy).toContain("6 live roles for Solidity");
    expect(copy).toContain("Solidity Engineer at Alpha Studio");
    expect(copy).toContain("0 live roles");
  });

  it("renders the directory bands above the count cards", async () => {
    const { default: HireHubPage } = await import("./page");
    const page = await HireHubPage();
    const directory = elements(page).find(
      (element) => element.props.className === "container hire-directory",
    );

    expect(directory).toBeDefined();
    expect(text(directory)).toContain("Web3 developers");
    expect(text(directory)).toContain("People in Web3");
  });

  it("issues exactly two bulk queries, not one per tag", async () => {
    const db = fakeDb();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    const { default: HireHubPage } = await import("./page");
    await HireHubPage();
    expect(db.prepare).toHaveBeenCalledTimes(2);
  });
});
