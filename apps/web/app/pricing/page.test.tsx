import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PLAN_COPY } from "../../lib/billing/plans";
import { PRICING_COPY } from "../../lib/legal/copy";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
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
  return text((node as ReactElement<{ children?: ReactNode }>).props.children);
}

describe("PricingPage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({
      env: { STRIPE_ENABLED: "false" },
    });
  });

  it("shows EUR plan labels and does not claim billing is live when Stripe is off", async () => {
    const { default: PricingPage } = await import("./page");
    const page = await PricingPage();
    const copy = text(page);
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);
    const checkoutForms = elements(page).filter(
      (element) =>
        element.type === "form" && element.props.action === "/api/stripe/checkout",
    );

    expect(copy).toContain(PRICING_COPY.title);
    expect(copy).toContain(PLAN_COPY.monthly.label);
    expect(copy).toContain(PLAN_COPY.yearly.label);
    expect(copy).toContain("€9 / month");
    expect(copy).toContain("€59 / year");
    expect(copy).toContain(PRICING_COPY.billingNotLive);
    expect(copy.toLowerCase()).not.toMatch(/billing is live/);
    expect(copy).not.toContain("100%");
    expect(checkoutForms).toHaveLength(0);
    expect(hrefs.some((href) => href === "/talent" || href.startsWith("/talent/"))).toBe(
      false,
    );
  });

  it("offers checkout only after STRIPE_ENABLED is true", async () => {
    mocks.getCloudflareContext.mockResolvedValue({
      env: { STRIPE_ENABLED: "true" },
    });
    const { default: PricingPage } = await import("./page");
    const page = await PricingPage();
    const copy = text(page);
    const checkoutForms = elements(page).filter(
      (element) =>
        element.type === "form" && element.props.action === "/api/stripe/checkout",
    );
    const plans = checkoutForms.map((form) => {
      const input = elements(form).find(
        (element) => element.type === "input" && element.props.name === "plan",
      );
      return input?.props.value;
    });

    expect(copy).not.toContain(PRICING_COPY.billingNotLive);
    expect(copy).toContain(PRICING_COPY.billingLive);
    expect(checkoutForms.length).toBeGreaterThan(0);
    expect(checkoutForms.every((form) => form.props.method === "post")).toBe(true);
    expect(plans).toEqual(expect.arrayContaining(["monthly", "yearly"]));
  });
});
