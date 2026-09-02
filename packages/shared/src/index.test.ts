import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index.ts";

describe("@gaming/shared", () => {
  it("exports a package name", () => {
    expect(PACKAGE_NAME).toBe("@gaming/shared");
  });
});
