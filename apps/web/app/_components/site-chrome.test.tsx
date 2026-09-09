import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { REGIONS } from "@gaming/shared";

import { SiteChrome } from "./site-chrome";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) =>
    React.createElement("a", props),
}));

vi.mock("./nav-mega", () => ({
  NavMega: ({
    menus,
  }: {
    menus: ReadonlyArray<{
      href: string;
      label: string;
      links: ReadonlyArray<{ href: string; label: string }>;
    }>;
  }) =>
    React.createElement(
      "nav",
      { "aria-label": "Primary" },
      menus.flatMap((menu) => [
        React.createElement("a", { href: menu.href, key: menu.href }, menu.label),
        ...menu.links.map((link) =>
          React.createElement(
            "a",
            { href: link.href, key: `${menu.label}-${link.href}` },
            link.label,
          ),
        ),
      ]),
    ),
}));

vi.mock("./mobile-menu", () => ({
  MobileMenu: ({
    menus,
  }: {
    menus: ReadonlyArray<{ href: string; label: string }>;
  }) =>
    React.createElement(
      "div",
      { "data-mobile": "true" },
      menus.map((menu) => React.createElement("a", { href: menu.href, key: menu.href }, menu.label)),
    ),
}));

vi.mock("./nav-account", () => ({
  NavAccount: () => null,
}));

vi.mock("./reveal-observer", () => ({
  RevealObserver: () => null,
}));

vi.stubGlobal("React", React);

/**
 * SiteChrome's nav lives inside child components, and a plain children-only walk never
 * sees it (see the tree-walk trap: a string inside a child component is invisible).
 * Every child component this file uses is mocked above and is a pure function, so the
 * walk calls it and folds its output into the same tree.
 */
function render(element: TestElement): ReactNode {
  if (typeof element.type !== "function") return element.props.children;
  const component = element.type as (props: unknown) => ReactNode;
  return component(element.props);
}

function elements(node: ReactNode): TestElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];

  const element = node as TestElement;
  return [element, ...elements(render(element))];
}

function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  return text(render(node as TestElement));
}

describe("SiteChrome", () => {
  it("exposes jobs, salaries, internships, companies, and footer browse links", () => {
    const page = SiteChrome({ children: null });
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);
    const copy = text(page);

    expect(hrefs).toContain("/jobs");
    expect(hrefs).toContain("/web3-salaries");
    expect(hrefs).toContain("/intern-jobs");
    expect(hrefs).toContain("/web3-companies");
    expect(hrefs).toContain("/remote-jobs");
    expect(hrefs).toContain("/web3-non-tech-salaries");
    expect(hrefs).toContain("/web3-cities");
    expect(hrefs).toContain("/faq");
    expect(hrefs).toContain("/what-is-web3");
    expect(hrefs).toContain("/learn-web3");
    expect(hrefs).toContain("/hire");
    expect(hrefs).toContain("/highest-paying-web3-jobs");
    expect(hrefs).toContain("/web3-salaries/solana-vs-ethereum");
    expect(hrefs).toContain("/top-web3-jobs");
    expect(hrefs).toContain("/highest-paid-non-tech-jobs");
    expect(hrefs).toContain("/web3-companies/top-growing");
    for (const slug of REGIONS) {
      expect(hrefs).toContain(`/web3-jobs-${slug}`);
    }
    expect(copy).toContain("Internships");
    expect(copy).toContain("Learn");
    expect(copy).toContain("Nodework");
    expect(copy).not.toMatch(/Bondex|wagmi|WxRK/i);
    expect(hrefs.some((href) => href === "/talent" || href.startsWith("/talent/"))).toBe(
      false,
    );
  });

  it("mirrors the reference navbar and footer link inventory", () => {
    const page = SiteChrome({ children: null });
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);
    const copy = text(page);

    // Site menu: the reference navbar's first dropdown carries these utility routes.
    for (const href of [
      "/",
      "/web3-jobs-api",
      "/ads",
      "/pricing",
      "/post-web3-job",
      "/login?intent=start",
    ]) {
      expect(hrefs, href).toContain(href);
    }

    // Footer long tail.
    for (const href of ["/crypto-events", "/terms", "/privacy", "/legal", "/about"]) {
      expect(hrefs, href).toContain(href);
    }

    // Five labelled navbar dropdowns, same grouping as the reference.
    for (const label of ["Jobs", "Salaries", "Internships", "Learn Web3", "TOP Web3 Jobs"]) {
      expect(copy, label).toContain(label);
    }

    // Our own copyright line, not theirs.
    expect(copy).toContain("© 2026");
    expect(copy).not.toMatch(/wagmi|Bondex ecosystem/i);
  });
});
