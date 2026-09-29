import { describe, expect, it } from "vitest";
import { trim } from "./projectPath";

describe("trim", () => {
  it("drops trailing slashes so a slashed path is the same project", () => {
    expect(trim("/repo/web/")).toBe("/repo/web");
    expect(trim("/repo/web//")).toBe("/repo/web");
    expect(trim("/repo/web")).toBe("/repo/web");
  });
});
