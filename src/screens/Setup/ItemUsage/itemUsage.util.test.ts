import { describe, expect, it } from "vitest";
import { errorRatePerDay } from "./itemUsage.util";

describe("errorRatePerDay", () => {
  it("is errors over uses, as a whole percentage", () => {
    expect(errorRatePerDay([{ day: "2026-09-25", uses: 3, errors: 1 }, { day: "2026-09-26", uses: 4, errors: 0 }]))
      .toEqual([{ day: "2026-09-25", rate: 33 }, { day: "2026-09-26", rate: 0 }]);
  });

  it("has no rate on a day with no uses, rather than a false 0%", () => {
    expect(errorRatePerDay([{ day: "2026-09-25", uses: 0, errors: 0 }])).toEqual([{ day: "2026-09-25", rate: null }]);
  });
});
