import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listJobs: vi.fn(),
  tagSalaryRange: vi.fn(),
}));

vi.mock("./queries", () => ({
  listJobs: mocks.listJobs,
  tagSalaryRange: mocks.tagSalaryRange,
}));

const {
  COMPANY_JOBS_LIMIT,
  RELATED_JOBS_LIMIT,
  jobDetailHireHref,
  jobDetailSalaryHref,
  loadJobDetailSections,
  pickPrimaryTag,
} = await import("./job-detail-sections");

function listItem(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    slug: `role-${id}`,
    externalId: id,
    title: `Role ${id}`,
    companyId: "company-1",
    companyName: "Alpha Studio",
    companySlug: "alpha-studio",
    location: "Remote",
    remote: "remote",
    salaryText: null,
    salaryMin: null,
    salaryMax: null,
    highlight: 0,
    featuredUntil: null,
    exclusivity: "unknown",
    postedAt: "2026-09-01T00:00:00Z",
    tags: ["solidity"],
    ...extra,
  };
}

describe("pickPrimaryTag", () => {
  it("prefers the craft tag over the seniority tag even though both are salary roles", () => {
    expect(pickPrimaryTag(["senior", "solidity", "dev"])).toBe("solidity");
    expect(pickPrimaryTag(["junior", "rust"])).toBe("rust");
  });

  it("prefers a role with a salary page over an incidental tag", () => {
    expect(pickPrimaryTag(["defi", "marketing"])).toBe("marketing");
  });

  it("falls back to the first specific tag, then to anything at all", () => {
    expect(pickPrimaryTag(["defi", "zk"])).toBe("defi");
    expect(pickPrimaryTag(["dev"])).toBe("dev");
    expect(pickPrimaryTag([])).toBeNull();
  });
});

describe("tail link builders", () => {
  it("maps a language tag to its {tag}-developer salary page", () => {
    expect(jobDetailSalaryHref("solidity")).toBe("/web3-salaries/solidity-developer");
    expect(jobDetailSalaryHref("marketing")).toBe("/web3-salaries/marketing");
  });

  it("returns null rather than a dead salary link", () => {
    expect(jobDetailSalaryHref("zk")).toBeNull();
  });

  it("only offers /hire for real job tags", () => {
    expect(jobDetailHireHref("solidity")).toBe("/hire/solidity");
    expect(jobDetailHireHref("not-a-tag-at-all")).toBeNull();
  });
});

describe("loadJobDetailSections", () => {
  const db = {} as never;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listJobs.mockResolvedValue({
      jobs: [listItem("a"), listItem("self"), listItem("b")],
      page: 1,
      pageSize: 20,
      total: 3,
      totalPages: 1,
    });
    mocks.tagSalaryRange.mockResolvedValue({ min: 90000, max: 210000, count: 7 });
  });

  it("queries the primary tag and the studio, and drops the job being viewed", async () => {
    const sections = await loadJobDetailSections(db, "tenant-1", {
      id: "self",
      companyName: "Alpha Studio",
      tags: ["senior", "solidity"],
    });

    expect(sections.primaryTag).toBe("solidity");
    expect(sections.relatedJobs.map((job) => job.id)).toEqual(["a", "b"]);
    expect(sections.companyJobs.map((job) => job.id)).toEqual(["a", "b"]);
    expect(mocks.listJobs).toHaveBeenCalledWith(db, "tenant-1", {
      tag: "solidity",
      pageSize: RELATED_JOBS_LIMIT + 1,
    });
    expect(mocks.listJobs).toHaveBeenCalledWith(db, "tenant-1", {
      company: "Alpha Studio",
      pageSize: COMPANY_JOBS_LIMIT + 1,
    });
    expect(sections.salary).toEqual({ min: 90000, max: 210000, count: 7 });
  });

  it("reports no salary when nothing on the tag publishes a range", async () => {
    mocks.tagSalaryRange.mockResolvedValue({ min: null, max: null, count: 0 });
    const sections = await loadJobDetailSections(db, "tenant-1", {
      id: "self",
      companyName: "Alpha Studio",
      tags: ["solidity"],
    });

    expect(sections.salary).toBeNull();
  });

  it("skips the tag reads entirely for an untagged job", async () => {
    const sections = await loadJobDetailSections(db, "tenant-1", {
      id: "self",
      companyName: "Alpha Studio",
      tags: [],
    });

    expect(sections.primaryTag).toBeNull();
    expect(sections.relatedJobs).toEqual([]);
    expect(mocks.tagSalaryRange).not.toHaveBeenCalled();
    expect(mocks.listJobs).toHaveBeenCalledTimes(1);
  });
});
