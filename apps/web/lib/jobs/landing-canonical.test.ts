import { describe, expect, it } from "vitest";

import { landingComboRedirect } from "./landing-canonical";

describe("landingComboRedirect", () => {
  it("leaves the canonical combo order alone", () => {
    expect(landingComboRedirect("remote+solidity-jobs")).toBeNull();
    expect(landingComboRedirect("backend+remote-jobs")).toBeNull();
  });

  it("redirects the reversed order to the canonical spelling", () => {
    expect(landingComboRedirect("solidity+remote-jobs")).toBe("/remote+solidity-jobs");
    expect(landingComboRedirect("remote+backend-jobs")).toBe("/backend+remote-jobs");
    expect(landingComboRedirect("remote+dev+junior-jobs")).toBe("/dev+junior+remote-jobs");
  });

  // The router hands the page a still-encoded segment. An encoded canonical
  // combo must resolve to "no redirect" or /remote%2Bsolidity-jobs loops.
  it("treats a percent-encoded canonical combo as already canonical", () => {
    expect(landingComboRedirect("remote%2Bsolidity-jobs")).toBeNull();
    expect(landingComboRedirect("remote%2bsolidity-jobs")).toBeNull();
  });

  it("redirects a percent-encoded reversed combo", () => {
    expect(landingComboRedirect("solidity%2Bremote-jobs")).toBe("/remote+solidity-jobs");
  });

  it("ignores non-combo slugs, including the hyphenated remote shape", () => {
    expect(landingComboRedirect("solidity-jobs")).toBeNull();
    expect(landingComboRedirect("remote-solidity-jobs")).toBeNull();
    expect(landingComboRedirect("web3-jobs-berlin")).toBeNull();
    expect(landingComboRedirect("intern-jobs")).toBeNull();
  });

  it("ignores combos that are not landings at all", () => {
    expect(landingComboRedirect("nonsense+garbage-jobs")).toBeNull();
    expect(landingComboRedirect("remote+berlin-jobs")).toBeNull();
  });

  it("folds a duplicated facet back to the single canonical URL", () => {
    expect(landingComboRedirect("remote+remote+solidity-jobs")).toBe(
      "/remote+solidity-jobs",
    );
  });
});
