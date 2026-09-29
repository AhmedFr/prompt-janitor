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

  it("falls back to a generic warning when the count is unknown", () => {
    expect(removalWarning(null)).toBe(
      "Removing this folder deletes its projects and their history from Prompt Janitor. Files on disk are not touched.",
    );
  });
});
