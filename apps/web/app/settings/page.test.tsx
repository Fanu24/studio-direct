import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  getSession: vi.fn(),
  first: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../../lib/auth/index", () => ({
  createAuth: () => ({
    api: {
      getSession: mocks.getSession,
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
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

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.first.mockResolvedValue({ talent_pool_opt_in: 0 });
    mocks.getCloudflareContext.mockResolvedValue({
      env: {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              first: mocks.first,
            })),
          })),
        },
        BETTER_AUTH_SECRET: "auth-secret",
        GOOGLE_CLIENT_ID: "google-client-id",
        GOOGLE_CLIENT_SECRET: "google-client-secret",
        EMAIL_FROM: "noreply@example.com",
        EMAIL: { send: vi.fn() },
      },
    });
  });

  it("redirects visitors without a session to login", async () => {
    mocks.getSession.mockResolvedValue(null);
    const { default: SettingsPage } = await import("./page");

    await expect(SettingsPage()).rejects.toThrow("REDIRECT:/login?next=/settings");
  });

  it("is the only opt-in surface and defaults the talent-pool checkbox off", async () => {
    const { default: SettingsPage } = await import("./page");
    const page = await SettingsPage();
    const copy = text(page);
    const namedInputs = elements(page).filter(
      (element) =>
        (element.type === "input" || element.type === "select")
        && typeof element.props.name === "string",
    );
    const checkbox = namedInputs.find(
      (element) =>
        element.props.name === "talent_pool_opt_in"
        && element.props.type === "checkbox",
    );
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);
    const form = elements(page).find(
      (element) =>
        element.type === "form"
        && element.props.action === "/api/account/talent-pool",
    );

    expect(page.props.title).toBe("Settings");
    expect(hrefs).toContain("/alerts");
    expect(copy).toContain("Show my profile to verified companies and recruiters");
    expect(copy).toMatch(/does not require/i);
    expect(copy).not.toContain("Clerk");
    expect(copy).not.toContain("Resend");
    expect(checkbox?.props.value).toBe("1");
    expect(checkbox?.props.defaultChecked).toBeFalsy();
    expect(form?.props.method).toMatch(/post/i);
    expect(hrefs.some((href) => href === "/talent" || href.startsWith("/talent/"))).toBe(
      false,
    );
  });

  it("offers English export download and account delete without public talent URLs", async () => {
    const { default: SettingsPage } = await import("./page");
    const page = await SettingsPage();
    const copy = text(page);
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);
    const exportLink = elements(page).find(
      (element) =>
        element.type === "a" && element.props.href === "/api/account/export",
    );
    const deleteForm = elements(page).find(
      (element) =>
        element.type === "form" && element.props.action === "/api/account/delete",
    );
    const deleteButton = deleteForm
      ? elements(deleteForm).find(
          (element) => element.type === "button" && element.props.type === "submit",
        )
      : undefined;

    expect(copy).toMatch(/download my data/i);
    expect(copy).toMatch(/delete my account/i);
    expect(exportLink).toBeTruthy();
    expect(deleteForm?.props.method).toMatch(/post/i);
    expect(text(deleteButton)).toMatch(/delete my account/i);
    expect(hrefs.some((href) => href === "/talent" || href.startsWith("/talent/"))).toBe(
      false,
    );
  });

  it("checks the talent-pool box only when the stored value is 1", async () => {
    mocks.first.mockResolvedValue({ talent_pool_opt_in: 1 });
    const { default: SettingsPage } = await import("./page");
    const page = await SettingsPage();
    const checkbox = elements(page).find(
      (element) =>
        element.type === "input"
        && element.props.name === "talent_pool_opt_in"
        && element.props.type === "checkbox",
    );

    expect(checkbox?.props.defaultChecked).toBe(true);
  });
});
