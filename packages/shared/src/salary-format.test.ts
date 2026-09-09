import { describe, expect, it } from "vitest";

import { formatSalaryRange, parseSalaryBounds } from "./salary.ts";

// formatSalaryRange has ~48 call sites across the web app and had no test of its own.
describe("formatSalaryRange", () => {
  it("renders a normal band in thousands", () => {
    expect(formatSalaryRange(120000, 240000)).toBe("$120k - $240k");
  });

  it("collapses a single value and a zero-width band", () => {
    expect(formatSalaryRange(90000, 90000)).toBe("$90k");
    expect(formatSalaryRange(90000, null)).toBe("$90k");
    expect(formatSalaryRange(null, 90000)).toBe("$90k");
  });

  it("returns null when there is nothing to show", () => {
    expect(formatSalaryRange(null, null)).toBeNull();
  });

  // A real listing states $1M-$5M in its own title. Rendering that as "$5000k" reads like a
  // units bug and invites someone to "fix" data that is correct.
  it("renders executive bands in millions", () => {
    expect(formatSalaryRange(1000000, 5000000)).toBe("$1M - $5M");
    expect(formatSalaryRange(250000, 1500000)).toBe("$250k - $1.5M");
  });

  it("round-trips a formatted band back through the parser", () => {
    const text = formatSalaryRange(120000, 240000);
    expect(parseSalaryBounds(text)).toEqual({ min: 120000, max: 240000 });
  });
});
