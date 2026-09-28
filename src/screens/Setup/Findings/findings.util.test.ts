import { describe, expect, it } from "vitest";
import { weakestTwo } from "./findings.util";

describe("weakestTwo", () => {
  it("names the two lowest dimensions, ties in their fixed order", () => {
    expect(weakestTwo([
      { dimension: "Clarity", score: 80 }, { dimension: "Consistency", score: 40 },
      { dimension: "Structure", score: 40 }, { dimension: "Examples", score: 90 }, { dimension: "Format", score: 70 },
    ])).toBe("Consistency & Structure");
  });
});
