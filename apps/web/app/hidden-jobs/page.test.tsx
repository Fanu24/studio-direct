import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../../lib/copy";

const mocks = vi.hoisted(() => ({
  getCloudflareContext: vi.fn(),
  listJobs: vi.fn(),
}));

vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: mocks.getCloudflareContext,
}));

vi.mock("../../lib/jobs/queries", () => ({
  listJobs: mocks.listJobs,
}));

vi.stubGlobal("React", React);

function text(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (!node || typeof node !== "object" || !("props" in node)) return "";
  return text((node as ReactElement<{ children?: ReactNode }>).props.children);
}

describe("HiddenJobsPage", () => {
  const db = {
    prepare: vi.fn(() => ({
      bind: vi.fn(() => ({
        first: vi.fn().mockResolvedValue("tenant-gaming"),
      })),
    })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCloudflareContext.mockResolvedValue({ env: { DB: db } });
    mocks.listJobs.mockResolvedValue({
      jobs: [],
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
    });
  });

  it("lists only confirmed jobs hidden from LinkedIn", async () => {
    const { default: HiddenJobsPage } = await import("./page");
    const page = await HiddenJobsPage();

    expect(mocks.listJobs).toHaveBeenCalledWith(db, "tenant-gaming", {
      hidden: true,
    });
    expect(text(page)).toContain("Jobs not posted on LinkedIn");
  });

  it("explains the badge with the locked tooltip and the no-realtime-LinkedIn sentence", async () => {
    const { default: HiddenJobsPage } = await import("./page");
    const page = await HiddenJobsPage();
    const content = text(page);

    expect(content).toContain("How the badge works");
    expect(content).toContain(LINKEDIN_EXCLUSIVITY_TOOLTIP);
    expect(content).toContain("We do not provide real-time LinkedIn coverage.");
  });
});
