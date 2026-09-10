import { describe, expect, it } from "vitest";

import { CAREER_FAQ_QUESTIONS, careerFaq } from "./faq.ts";
import { landingRoleFaq, roleWhatTheyDo } from "./role-blurbs.ts";

describe("careerFaq", () => {
  it("answers the Web3 career questions with original Nodework copy", () => {
    const faq = careerFaq({ jobCount: 42 });
    const questions = faq.map((item) => item.question);
    const answers = faq.map((item) => item.answer).join(" ");

    expect(questions).toEqual([...CAREER_FAQ_QUESTIONS]);
    expect(questions).toContain("How does Web3 work?");
    expect(questions).toContain("Is Web3 a cryptocurrency?");
    expect(answers).toContain("42 open roles");
    expect(answers).not.toContain("What is Nodework?");
    expect(answers).not.toMatch(/[–—]/);
  });
});

describe("roleWhatTheyDo", () => {
  it("writes a unique front-end blurb instead of a mad-lib", () => {
    const item = roleWhatTheyDo("front-end");
    expect(item.question).toBe("What does a Front End developer do?");
    expect(item.answer.toLowerCase()).toContain("wallet");
    expect(item.answer).toContain("React");
    expect(item.answer).not.toContain("depends on Front End skills");
    expect(item.answer).not.toMatch(/[–—]/);
  });

  it("keeps Solana, Solidity, and intern answers specific", () => {
    expect(roleWhatTheyDo("solana").question).toBe("What does a Solana developer do?");
    expect(roleWhatTheyDo("solana").answer.toLowerCase()).toContain("rust");
    expect(roleWhatTheyDo("solidity").answer.toLowerCase()).toContain("evm");
    expect(roleWhatTheyDo("intern").question).toBe("What does a Web3 intern do?");
    expect(roleWhatTheyDo("intern").answer).not.toMatch(/[–—]/);
  });
});

describe("landingRoleFaq", () => {
  it("injects live counts without falling back to depends-on copy", () => {
    const item = landingRoleFaq(
      { kind: "tag", tag: "front-end", tags: ["front-end"] },
      { total: 9, salaryRange: "$90k - $160k" },
    );
    expect(item.answer).toContain("9 roles");
    expect(item.answer).toContain("$90k - $160k");
    expect(item.answer).not.toContain("depends on Front End skills");
    expect(item.answer).not.toMatch(/[–—]/);
  });
});
