import { HUB_ROLE_SLUGS, hubSlugLabel } from "@gaming/shared";
import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

type TestElement = ReactElement<
  Record<string, unknown> & { children?: ReactNode }
>;

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  getSession: vi.fn(),
  first: vi.fn(),
  all: vi.fn(),
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

describe("ProfilePage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.first.mockImplementation(async (column?: string) => {
      if (column === "count") return 0;
      return {
        display_name: "Ada",
        target_role: "Gameplay Programmer",
        location: null,
        remote_pref: "remote",
        cv_r2_key: null,
      };
    });
    mocks.all.mockResolvedValue({ results: [] });
    mocks.getCloudflareContext.mockResolvedValue({
      env: {
        DB: {
          prepare: vi.fn(() => ({
            bind: vi.fn(() => ({
              first: mocks.first,
              all: mocks.all,
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
    const { default: ProfilePage } = await import("./page");

    await expect(ProfilePage()).rejects.toThrow("REDIRECT:/login?next=/profile");
  });

  it("collects experience, hub skills, location, and a PDF CV without talent-pool", async () => {
    const { default: ProfilePage } = await import("./page");
    const page = await ProfilePage();
    const copy = text(page);
    const namedInputs = elements(page).filter(
      (element) =>
        (element.type === "input" || element.type === "select")
        && typeof element.props.name === "string",
    );
    const names = namedInputs.map((element) => element.props.name);
    const skillValues = namedInputs
      .filter((element) => element.props.name === "skill")
      .map((element) => element.props.value);
    const hrefs = elements(page)
      .filter((element) => typeof element.props.href === "string")
      .map((element) => element.props.href as string);

    expect(copy).toMatch(/profile/i);
    expect(copy).toContain("20%");
    expect(copy).toContain("Experience");
    expect(copy).toContain("Skills");
    expect(names).toEqual(expect.arrayContaining([
      "company",
      "title",
      "skill",
      "location",
      "remote_pref",
    ]));
    expect(skillValues).toEqual(expect.arrayContaining([...HUB_ROLE_SLUGS]));
    expect(copy).toContain(hubSlugLabel("gameplay-programmer"));
    expect(names).not.toContain("talent_pool_opt_in");
    expect(copy.toLowerCase()).not.toContain("talent pool");
    expect(copy).not.toContain("Clerk");
    expect(copy).not.toContain("Resend");
    const fileInput = namedInputs.find((element) => element.props.type === "file");
    expect(fileInput?.props.name).toBe("cv");
    expect(fileInput?.props.accept).toBe("application/pdf");
    const cvForm = elements(page).find(
      (element) =>
        element.type === "form"
        && element.props.action === "/api/profile/cv",
    );
    expect(cvForm?.props.method).toMatch(/post/i);
    expect(cvForm?.props.encType).toBe("multipart/form-data");
    expect(hrefs.some((href) => href === "/talent" || href.startsWith("/talent/"))).toBe(false);
  });
});
