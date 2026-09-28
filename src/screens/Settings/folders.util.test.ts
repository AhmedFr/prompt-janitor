import { describe, expect, it } from "vitest";
import { removalWarning } from "./folders.util";

describe("removalWarning", () => {
  it("says exactly what the spec says, with the count", () => {
    expect(removalWarning(3)).toBe(
      "Removes 3 projects and their history from Prompt Janitor. Files on disk are not touched.",
    );
  });

  it("uses the singular for one project", () => {
    expect(removalWarning(1)).toBe(
      "Removes 1 project and its history from Prompt Janitor. Files on disk are not touched.",
    );
  });
});
