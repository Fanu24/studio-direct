import { describe, expect, it } from "vitest";

import { careerFaq, CAREER_FAQ_QUESTIONS } from "./faq.ts";
import { landingRoleFaq, roleWhatTheyDo } from "./role-blurbs.ts";
import { BENEFITS, FEATURED_TAG_CHIPS } from "../taxonomy.ts";

const NON_PAY_IN_CRYPTO_BENEFITS = BENEFITS.filter((benefit) => benefit !== "pay-in-crypto");

const MADLIB =
  "developers on Nodework listings design, ship, and maintain product work that depends on";

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

describe("roleWhatTheyDo", () => {
  it("writes unique 120-220 word blurbs for every featured chip", () => {
    const answers = new Set<string>();

    for (const tag of FEATURED_TAG_CHIPS) {
      const item = roleWhatTheyDo(tag);
      const words = wordCount(item.answer);
      expect(item.question.length).toBeGreaterThan(10);
      expect(words).toBeGreaterThanOrEqual(120);
      expect(words).toBeLessThanOrEqual(220);
      expect(item.answer).not.toMatch(/[–—]/);
      expect(item.question).not.toMatch(/[–—]/);
      expect(item.answer.toLowerCase()).not.toContain(MADLIB);
      expect(answers.has(item.answer)).toBe(false);
      answers.add(item.answer);
    }
  });

  it("describes front-end as dapp UI, wallets, React, and TypeScript", () => {
    const item = roleWhatTheyDo("front-end");
    expect(item.question).toBe("What does a Front End developer do?");
    expect(item.answer).toMatch(/dapp UI/i);
    expect(item.answer).toMatch(/wallet/i);
    expect(item.answer).toMatch(/React/);
    expect(item.answer).toMatch(/TypeScript/);
    expect(item.answer).not.toMatch(/depends on Front End skills/i);
  });

  it("describes solidity as contracts, EVM, and audits", () => {
    const item = roleWhatTheyDo("solidity");
    expect(item.question).toBe("What does a Solidity developer do?");
    expect(item.answer).toMatch(/contract/i);
    expect(item.answer).toMatch(/EVM/);
    expect(item.answer).toMatch(/audit/i);
  });

  it("describes solana as Rust, programs, and accounts", () => {
    const item = roleWhatTheyDo("solana");
    expect(item.question).toBe("What does a Solana developer do?");
    expect(item.answer).toMatch(/Rust/);
    expect(item.answer).toMatch(/program/i);
    expect(item.answer).toMatch(/account/i);
  });

  it("does not call marketing, sales, or design developers", () => {
    expect(roleWhatTheyDo("marketing").question).not.toMatch(/developer/i);
    expect(roleWhatTheyDo("sales").question).not.toMatch(/developer/i);
    expect(roleWhatTheyDo("design").question).not.toMatch(/developer/i);
    expect(roleWhatTheyDo("marketing").question).toMatch(/marketer/i);
    expect(roleWhatTheyDo("sales").question).toMatch(/sales/i);
    expect(roleWhatTheyDo("design").question).toMatch(/designer/i);
  });

  it("writes a bespoke blurb for every benefit slug other than pay-in-crypto", () => {
    // Every benefit used to funnel through one shared fallback paragraph
    // (a 20-URL duplicate-content pattern for both visible copy and FAQPage
    // JSON-LD). Assert each benefit now has its own distinct question and
    // answer instead of repeating a generic paragraph across all 20 URLs.
    const answers = new Set<string>();
    const questions = new Set<string>();

    for (const benefit of NON_PAY_IN_CRYPTO_BENEFITS) {
      const item = roleWhatTheyDo(benefit);
      const words = wordCount(item.answer);
      expect(words).toBeGreaterThanOrEqual(120);
      expect(words).toBeLessThanOrEqual(220);
      expect(item.answer).not.toMatch(/[–—]/);
      expect(item.question).not.toMatch(/[–—]/);
      expect(answers.has(item.answer)).toBe(false);
      expect(questions.has(item.question)).toBe(false);
      answers.add(item.answer);
      questions.add(item.question);
    }

    expect(answers.size).toBe(NON_PAY_IN_CRYPTO_BENEFITS.length);
  });

  it("uses family fallback copy without the banned mad-lib", () => {
    const unknown = roleWhatTheyDo("definitely-not-a-real-tag");
    expect(unknown.answer.toLowerCase()).not.toContain(MADLIB);
    expect(unknown.answer).not.toMatch(/[–—]/);
    expect(wordCount(unknown.answer)).toBeGreaterThanOrEqual(120);
    expect(wordCount(unknown.answer)).toBeLessThanOrEqual(220);
    expect(unknown.question).toMatch(/developer/i);
  });
});

describe("landingRoleFaq", () => {
  it("gives intern, entry, geo, and benefit unique questions", () => {
    expect(landingRoleFaq({ kind: "intern" }).question).toBe(
      "What does a Web3 intern do?",
    );
    expect(landingRoleFaq({ kind: "entry-level" }).question).toBe(
      "What does an entry level Web3 job look like?",
    );
    expect(landingRoleFaq({ kind: "city", city: "new-york" }).question).toBe(
      "What is the Web3 job market in New York?",
    );
    expect(
      landingRoleFaq({ kind: "benefit", benefit: "pay-in-crypto" }).question,
    ).toBe("What does pay in crypto mean on a Web3 job?");
    expect(landingRoleFaq({ kind: "tag", tag: "solana", tags: ["solana"] }).question).toBe(
      "What does a Solana developer do?",
    );
  });

  it("injects live stats when provided and stays qualitative without them", () => {
    const withStats = landingRoleFaq(
      { kind: "tag", tag: "solidity", tags: ["solidity"] },
      { total: 12, salaryRange: "$100k - $180k" },
    );
    expect(withStats.answer).toContain("12");
    expect(withStats.answer).toContain("$100k - $180k");

    const bare = landingRoleFaq({ kind: "tag", tag: "solidity", tags: ["solidity"] });
    expect(bare.answer).not.toMatch(/\b12\b/);
  });
});

describe("careerFaq", () => {
  it("uses web3.career-style questions with original Nodework answers", () => {
    const faq = careerFaq();
    expect(faq.map((item) => item.question)).toEqual([...CAREER_FAQ_QUESTIONS]);
    for (const item of faq) {
      const words = wordCount(item.answer);
      expect(words).toBeGreaterThanOrEqual(80);
      expect(words).toBeLessThanOrEqual(180);
      expect(item.answer).not.toMatch(/[–—]/);
      expect(item.question).not.toMatch(/[–—]/);
    }
    expect(faq.some((item) => item.question === "How does Web3 work?")).toBe(true);
    expect(faq.some((item) => item.question === "What is Nodework?")).toBe(false);
  });

  it("does not invent job counts when stats are omitted", () => {
    const faq = careerFaq();
    const places = faq.find((item) => item.question === "Which places hire the most?");
    expect(places?.answer).not.toMatch(/\b3,?\d{3}\b/);
    expect(places?.answer.toLowerCase()).toContain("remote");
  });
});
