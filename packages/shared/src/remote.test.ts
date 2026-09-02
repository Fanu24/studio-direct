import { describe, expect, it } from "vitest";
import { classifyRemote } from "./index.ts";

describe("classifyRemote", () => {
  it("classifies a remote title", () => {
    expect(
      classifyRemote({
        title: "Remote Unity Developer",
        location: null,
        descriptionHtml: "",
      }),
    ).toBe("remote");
  });

  it("classifies a five-day office location as onsite", () => {
    expect(
      classifyRemote({
        title: "Unity Developer",
        location: "London, UK (5 days office)",
        descriptionHtml: "",
      }),
    ).toBe("onsite");
  });

  it.each([
    {
      title: "Hybrid, 2 days in office",
      location: null,
      descriptionHtml: "",
    },
    {
      title: "Unity Developer",
      location: "Hybrid, 2 days in office",
      descriptionHtml: "",
    },
    {
      title: "Unity Developer",
      location: null,
      descriptionHtml: "<p>Hybrid, 2 days in office</p>",
    },
  ])("classifies hybrid wording in any input field", (input) => {
    expect(classifyRemote(input)).toBe("hybrid");
  });

  it("returns unknown without a remote-work signal", () => {
    expect(
      classifyRemote({
        title: "Unity Developer",
        location: "London, UK",
        descriptionHtml: "<p>Build gameplay systems.</p>",
      }),
    ).toBe("unknown");
  });
});
