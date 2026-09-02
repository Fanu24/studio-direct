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
  loadProfileCompleteness: vi.fn(),
  loadProfileDetails: vi.fn(),
  countUnlocksThisWeek: vi.fn(),
  listRecentUnlocks: vi.fn(),
  loadSubscriptionStatus: vi.fn(),
  listJobs: vi.fn(),
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

vi.mock("../../lib/profile/completeness", () => ({
  loadProfileCompleteness: mocks.loadProfileCompleteness,
  loadProfileDetails: mocks.loadProfileDetails,
}));

vi.mock("../../lib/unlocks/history", () => ({
  countUnlocksThisWeek: mocks.countUnlocksThisWeek,
  listRecentUnlocks: mocks.listRecentUnlocks,
  loadSubscriptionStatus: mocks.loadSubscriptionStatus,
}));

vi.mock("../../lib/jobs/queries", () => ({
  listJobs: mocks.listJobs,
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

function hrefs(node: ReactNode): string[] {
  return elements(node)
    .filter((element) => typeof element.props.href === "string")
    .map((element) => element.props.href as string);
}

describe("DashboardPage", () => {
  const db = {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: mocks.first,
      })),
    })),
  };

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { id: "user-1" } });
    mocks.first.mockResolvedValue("tenant-gaming");
    mocks.getCloudflareContext.mockResolvedValue({
      env: {
        DB: db,
        BETTER_AUTH_SECRET: "auth-secret",
        GOOGLE_CLIENT_ID: "google-client-id",
        GOOGLE_CLIENT_SECRET: "google-client-secret",
        EMAIL_FROM: "noreply@example.com",
        EMAIL: { send: vi.fn() },
      },
    });
    mocks.loadProfileCompleteness.mockResolvedValue(40);
    mocks.loadProfileDetails.mockResolvedValue({
      display_name: "Ada",
      target_role: "Gameplay Programmer",
      location: null,
      remote_pref: "remote",
      cv_r2_key: null,
    });
    mocks.countUnlocksThisWeek.mockResolvedValue(2);
    mocks.loadSubscriptionStatus.mockResolvedValue({ paid: false, periodEnd: null });
    mocks.listRecentUnlocks.mockResolvedValue([
      {
        jobId: "job-1",
        slug: "riot-games-senior-gameplay-engineer",
        title: "Senior Gameplay Engineer",
        companyName: "Riot Games",
        unlockedAt: "2026-09-01T09:00:00.000Z",
      },
    ]);
    mocks.listJobs.mockResolvedValue({
      jobs: [
        {
          id: "latest-hidden",
          slug: "latest-hidden",
          title: "Latest Hidden Role",
          companyId: "studio-a",
          companyName: "Alpha Studio",
          companySlug: "alpha-studio",
          location: "London",
          remote: "remote",
          salaryText: null,
          exclusivity: "hidden_from_linkedin",
          postedAt: "2026-09-02T00:00:00Z",
        },
      ],
      page: 1,
      pageSize: 4,
      total: 1,
      totalPages: 1,
    });
  });

  it("redirects visitors without a session to login", async () => {
    mocks.getSession.mockResolvedValue(null);
    const { default: DashboardPage } = await import("./page");

    await expect(DashboardPage()).rejects.toThrow("REDIRECT:/login");
    expect(mocks.listJobs).not.toHaveBeenCalled();
  });

  it("greets by display name and shows unlock, profile and plan tiles for a free account", async () => {
    const { default: DashboardPage } = await import("./page");
    const page = await DashboardPage();
    const copy = text(page);
    const links = hrefs(page);

    expect(page.props.title).toBe("Hi Ada");
    expect(page.props.active).toBe("dashboard");
    expect(mocks.countUnlocksThisWeek).toHaveBeenCalledWith(db, "user-1", expect.any(Date));
    expect(mocks.loadSubscriptionStatus).toHaveBeenCalledWith(db, "user-1", expect.any(Date));
    expect(mocks.listRecentUnlocks).toHaveBeenCalledWith(db, "user-1", 5);
    expect(copy).toContain("Unlocks this week");
    expect(copy).toContain("2 of 5 used, resets Monday UTC");
    expect(copy).toContain("40%");
    expect(copy).toContain("Free plan");
    expect(copy).not.toContain("Unlimited unlocks");
    expect(links).toEqual(expect.arrayContaining(["/jobs", "/profile", "/pricing"]));
    expect(copy).not.toContain("Clerk");
    expect(copy).not.toContain("Resend");
    expect(links.some((href) => href === "/talent" || href.startsWith("/talent/"))).toBe(
      false,
    );
  });

  it("lists recent unlocks and the latest four jobs not on LinkedIn", async () => {
    const { default: DashboardPage } = await import("./page");
    const page = await DashboardPage();
    const copy = text(page);
    const links = hrefs(page);

    expect(db.prepare).toHaveBeenCalledWith("SELECT id FROM tenants WHERE slug = ?");
    expect(mocks.listJobs).toHaveBeenCalledWith(db, "tenant-gaming", {
      hidden: true,
      pageSize: 4,
    });
    expect(copy).toContain("Recent unlocks");
    expect(copy).toContain("Senior Gameplay Engineer");
    expect(copy).toContain("Riot Games");
    expect(copy).toContain("1 Sept 2026");
    expect(links).toContain("/jobs/riot-games-senior-gameplay-engineer");
    expect(copy).toContain("Latest jobs not on LinkedIn");
    expect(copy).toContain("Latest Hidden Role");
    expect(links).toContain("/jobs/latest-hidden");
    expect(links).toContain("/hidden-jobs");
  });

  it("marks saved jobs and the hidden digest as not available yet", async () => {
    const { default: DashboardPage } = await import("./page");
    const page = await DashboardPage();
    const copy = text(page);
    const tags = elements(page)
      .filter((element) => element.props.className === "tag")
      .map((element) => text(element));

    expect(copy).toContain("Saved jobs");
    expect(copy).toContain("Hidden digest");
    expect(tags).toEqual(expect.arrayContaining(["Not available yet", "Paid plan, not live yet"]));
    expect(copy).not.toMatch(/auto-apply/i);
    expect(copy).not.toMatch(/cover letter/i);
  });

  it("shows unlimited unlocks and the paid period for a paid account", async () => {
    mocks.loadSubscriptionStatus.mockResolvedValue({
      paid: true,
      periodEnd: "2026-10-01T00:00:00.000Z",
    });
    mocks.countUnlocksThisWeek.mockResolvedValue(9);
    const { default: DashboardPage } = await import("./page");
    const page = await DashboardPage();
    const copy = text(page);

    expect(copy).toContain("Unlimited unlocks");
    expect(copy).toContain("Paid until 1 Oct 2026");
    expect(copy).not.toContain("resets Monday UTC");
  });

  it("falls back to a neutral title and an empty unlock state", async () => {
    mocks.loadProfileDetails.mockResolvedValue(null);
    mocks.listRecentUnlocks.mockResolvedValue([]);
    mocks.countUnlocksThisWeek.mockResolvedValue(0);
    const { default: DashboardPage } = await import("./page");
    const page = await DashboardPage();
    const copy = text(page);

    expect(page.props.title).toBe("Your dashboard");
    expect(copy).toContain("0 of 5 used, resets Monday UTC");
    expect(copy).toContain("No unlocks yet.");
  });
});
