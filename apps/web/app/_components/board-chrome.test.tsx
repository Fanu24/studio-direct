import { landingPath, type LandingKind } from "@gaming/shared";
import React, { type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { BoardSearch, remoteFilterHref, remoteToggleState } from "./board-chrome";
import { TagChips } from "./tag-chips";

vi.mock("next/link", () => ({
  default: (props: Record<string, unknown>) => React.createElement("a", props),
}));

vi.stubGlobal("React", React);

type TestElement = ReactElement<Record<string, unknown> & { children?: ReactNode }>;

function elements(node: ReactNode): TestElement[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!node || typeof node !== "object" || !("props" in node)) return [];
  const element = node as TestElement;
  return [element, ...elements(element.props.children)];
}

describe("remoteFilterHref", () => {
  const cases: { name: string; landing: LandingKind | undefined; expected: LandingKind }[] = [
    { name: "no landing", landing: undefined, expected: { kind: "remote" } },
    {
      name: "single tag",
      landing: { kind: "tag", tag: "solidity", tags: ["solidity"] },
      expected: { kind: "remote-tag", tag: "solidity", tags: ["solidity"] },
    },
    {
      name: "multi-tag combo",
      landing: { kind: "tag", tag: "dev", tags: ["dev", "junior"] },
      expected: { kind: "remote-tag", tag: "dev", tags: ["dev", "junior"] },
    },
    {
      name: "already remote-tag",
      landing: { kind: "remote-tag", tag: "solidity", tags: ["solidity"] },
      expected: { kind: "remote-tag", tag: "solidity", tags: ["solidity"] },
    },
    { name: "already remote", landing: { kind: "remote" }, expected: { kind: "remote" } },
    {
      name: "intern",
      landing: { kind: "intern" },
      expected: { kind: "remote-tag", tag: "intern", tags: ["intern"] },
    },
    {
      name: "entry-level",
      landing: { kind: "entry-level" },
      expected: { kind: "remote-tag", tag: "entry-level", tags: ["entry-level"] },
    },
    {
      name: "benefit",
      landing: { kind: "benefit", benefit: "pay-in-crypto" },
      expected: { kind: "remote" },
    },
    {
      name: "city",
      landing: { kind: "city", city: "berlin" },
      expected: { kind: "remote" },
    },
    {
      name: "country",
      landing: { kind: "country", country: "germany" },
      expected: { kind: "remote" },
    },
    {
      name: "region",
      landing: { kind: "region", region: "europe" },
      expected: { kind: "remote" },
    },
  ];

  it.each(cases)("$name round-trips through landingPath", ({ landing, expected }) => {
    expect(remoteFilterHref(landing)).toBe(landingPath(expected));
  });

  it("emits the canonical + form, not the legacy hyphen alias, for a single tag", () => {
    expect(remoteFilterHref({ kind: "tag", tag: "solidity", tags: ["solidity"] })).toBe(
      "/remote+solidity-jobs",
    );
  });
});

describe("TagChips", () => {
  it("keeps a plain string `active` working (backward compatible)", () => {
    const tree = TagChips({ active: "solidity" });
    const solidity = elements(tree).find(
      (element) => element.props.href === "/solidity-jobs",
    );
    expect(solidity).toBeDefined();
    expect(String(solidity?.props.className)).toContain("chip--on");
  });

  it("preserves remote state: chip hrefs stay remote-tag combos when remote=true", () => {
    const tree = TagChips({ active: ["solidity"], remote: true });
    const hrefs = elements(tree)
      .map((element) => element.props.href)
      .filter((href): href is string => typeof href === "string");
    const remoteSolidityHref = landingPath({
      kind: "remote-tag",
      tag: "solidity",
      tags: ["solidity"],
    });

    expect(hrefs).toContain(remoteSolidityHref);
    expect(hrefs).not.toContain("/solidity-jobs");

    const solidity = elements(tree).find(
      (element) => element.props.href === remoteSolidityHref,
    );
    expect(String(solidity?.props.className)).toContain("chip--on");
  });

  it("marks every tag in a multi-tag active array as on", () => {
    const tree = TagChips({ active: ["design", "marketing"] });
    const chips = elements(tree).filter((element) =>
      String(element.props.className ?? "").includes("chip--on"),
    );
    const onHrefs = chips.map((chip) => chip.props.href);
    expect(onHrefs).toContain("/design-jobs");
    expect(onHrefs).toContain("/marketing-jobs");
  });
});


/**
 * The control is drawn as a switch, so these assert it behaves like one. It
 * used to be a one-way link: on `/remote-jobs` it still pointed at
 * `/remote-jobs` and carried no on state, so it never looked set and clicking
 * it did nothing. Both halves are covered here - where it goes, and what it
 * says about itself - because either one alone would have passed against the
 * broken version.
 */
describe("the remote switch", () => {
  it("turns on from an unfiltered page", () => {
    const state = remoteToggleState();
    expect(state.active).toBe(false);
    expect(state.href).toBe("/remote-jobs");
  });

  it("turns off again from a remote page, rather than pointing at itself", () => {
    const state = remoteToggleState({ kind: "remote" });
    expect(state.active).toBe(true);
    expect(state.href).toBe("/jobs");
    expect(state.href).not.toBe("/remote-jobs");
  });

  it("drops only the remote part from a remote-tag page, keeping the tags", () => {
    const landing: LandingKind = { kind: "remote-tag", tag: "solidity", tags: ["solidity"] };
    const state = remoteToggleState(landing);
    expect(state.active).toBe(true);
    expect(state.href).toBe(landingPath({ kind: "tag", tag: "solidity", tags: ["solidity"] }));
  });

  it("says which way it is set, for anything that cannot see the colour", () => {
    const off = elements(BoardSearch({ remoteHref: "/remote-jobs" })).find(
      (el) => typeof el.props.className === "string" &&
        el.props.className.includes("remote-toggle"),
    );
    expect(off?.props["aria-checked"]).toBe(false);
    expect(off?.props.role).toBe("switch");
    expect(String(off?.props.className)).not.toContain("remote-toggle--on");

    const on = elements(BoardSearch({ remoteHref: "/jobs", remoteActive: true })).find(
      (el) => typeof el.props.className === "string" &&
        el.props.className.includes("remote-toggle"),
    );
    expect(on?.props["aria-checked"]).toBe(true);
    expect(String(on?.props.className)).toContain("remote-toggle--on");
  });
});
