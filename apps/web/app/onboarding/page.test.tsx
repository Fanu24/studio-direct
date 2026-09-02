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

describe("OnboardingPage", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.first.mockResolvedValue(null);
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

  it("collects display name, target role, and remote preference without a talent-pool checkbox", async () => {
    const { default: OnboardingPage } = await import("./page");
    const page = await OnboardingPage({
      searchParams: Promise.resolve({ next: "/jobs/gameplay-engineer" }),
    });
    const copy = text(page);
    const namedInputs = elements(page).filter(
      (element) =>
        (element.type === "input" || element.type === "select")
        && typeof element.props.name === "string",
    );
    const names = namedInputs.map((element) => element.props.name);

    expect(copy).toContain("display name");
    expect(copy).toContain("target role");
    expect(copy).toMatch(/remote/i);
    expect(names).toEqual(expect.arrayContaining([
      "display_name",
      "target_role",
      "remote_pref",
    ]));
    expect(names).not.toContain("talent_pool_opt_in");
    expect(copy.toLowerCase()).not.toContain("talent pool");
    expect(copy).not.toContain("Clerk");
    expect(copy).not.toContain("Resend");

    const checkboxes = elements(page).filter(
      (element) => element.type === "input" && element.props.type === "checkbox",
    );
    expect(checkboxes).toHaveLength(0);
  });
});
