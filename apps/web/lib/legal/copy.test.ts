import { describe, expect, it } from "vitest";

import { PLAN_COPY } from "../billing/plans";
import { HOMEPAGE_CLAIM, LINKEDIN_EXCLUSIVITY_TOOLTIP } from "../copy";
import {
  LEGAL_ENTITY_PLACEHOLDER,
  PRICING_COPY,
  PRIVACY_COPY,
  TERMS_COPY,
} from "./copy";

function legalText(): string {
  return JSON.stringify({
    LEGAL_ENTITY_PLACEHOLDER,
    TERMS_COPY,
    PRIVACY_COPY,
    PRICING_COPY,
  });
}

describe("TERMS_COPY", () => {
  it("says listings come from third parties", () => {
    expect(legalText().toLowerCase()).toMatch(/third part/);
    expect(TERMS_COPY.thirdParties.toLowerCase()).toMatch(/third part/);
  });

  it("says inventory may be incomplete", () => {
    expect(TERMS_COPY.incomplete.toLowerCase()).toMatch(/incomplete/);
  });

  it("does not claim real-time LinkedIn", () => {
    expect(TERMS_COPY.noRealtimeLinkedIn.toLowerCase()).toMatch(
      /no real-time linkedin|not (provide |offer )?real-time linkedin/,
    );
  });

  it("states the approved badge meaning verbatim", () => {
    expect(TERMS_COPY.badgeMeaning).toBe(LINKEDIN_EXCLUSIVITY_TOOLTIP);
    expect(TERMS_COPY.badgeMeaning).toBe(
      "We did not find this role on LinkedIn in our last successful index.",
    );
  });
});

describe("PRIVACY_COPY", () => {
  it("separates job-board product use from recruiter talent-pool opt-in", () => {
    expect(PRIVACY_COPY.jobProductPurpose.toLowerCase()).toMatch(/job/);
    expect(PRIVACY_COPY.recruiterOptInPurpose.toLowerCase()).toMatch(
      /recruiter|talent pool/,
    );
    expect(PRIVACY_COPY.recruiterOptInPurpose.toLowerCase()).toMatch(
      /opt-in|opt in/,
    );
    expect(PRIVACY_COPY.recruiterOptInPurpose.toLowerCase()).toMatch(
      /off by default|default(?:s)?(?: to)? off/,
    );
  });

  it("uses a legal-entity placeholder until launch", () => {
    expect(PRIVACY_COPY.legalEntity).toBe(LEGAL_ENTITY_PLACEHOLDER);
    expect(TERMS_COPY.legalEntity).toBe(LEGAL_ENTITY_PLACEHOLDER);
    expect(LEGAL_ENTITY_PLACEHOLDER.toLowerCase()).toMatch(
      /placeholder|to be confirmed|before launch|not yet incorporated/,
    );
    expect(LEGAL_ENTITY_PLACEHOLDER).not.toMatch(/\b(Ltd|LLC|Inc|GmbH|S\.A\.|PLC)\b/);
  });
});

describe("PRICING_COPY", () => {
  it("reuses Task 34 EUR plan labels", () => {
    expect(PRICING_COPY.monthly).toBe(PLAN_COPY.monthly.label);
    expect(PRICING_COPY.yearly).toBe(PLAN_COPY.yearly.label);
    expect(PRICING_COPY.monthly).toBe("€9 / month");
    expect(PRICING_COPY.yearly).toBe("€59 / year");
  });

  it("does not claim billing is live while checkout is gated", () => {
    expect(PRICING_COPY.billingNotLive.toLowerCase()).toMatch(/not live/);
    expect(legalText().toLowerCase()).not.toMatch(/billing is live/);
  });
});

describe("legal copy honesty", () => {
  it("never claims 100% coverage", () => {
    expect(legalText()).not.toContain("100%");
    expect(HOMEPAGE_CLAIM).not.toContain("100%");
    expect(HOMEPAGE_CLAIM).toBe(
      "Browse Web3, blockchain and crypto jobs. Filter by skill, location and salary.",
    );
  });
});
