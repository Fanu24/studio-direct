import React, { type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
});
