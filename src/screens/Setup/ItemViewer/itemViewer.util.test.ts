import { describe, expect, it } from "vitest";
import { stepTarget } from "./itemViewer.util";

describe("stepTarget", () => {
  const ids = ["3", "1", "7"];
  it("moves to the next and previous row in on-screen order", () => {
    expect(stepTarget(ids, "1", 1)).toBe("7");
    expect(stepTarget(ids, "1", -1)).toBe("3");
  });
  it("clamps at the ends", () => {
    expect(stepTarget(ids, "7", 1)).toBe("7");
    expect(stepTarget(ids, "3", -1)).toBe("3");
  });
  it("gives nothing when the open row is no longer on screen", () => {
    expect(stepTarget(ids, "9", 1)).toBeNull();
  });
});
