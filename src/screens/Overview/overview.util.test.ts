import { describe, it, expect } from "vitest";
import { formatTrendDelta } from "./overview.util";

const SEP_1_NOON = String(Date.UTC(2026, 8, 1, 12) / 1000);

describe("formatTrendDelta", () => {
  it("signs a gain and dates it from the window's first point", () => {
    expect(formatTrendDelta(18, SEP_1_NOON)).toBe("+18 since Sep 1");
  });

  it("uses a true minus sign for a drop", () => {
    expect(formatTrendDelta(-6, SEP_1_NOON)).toBe("−6 since Sep 1");
  });

  it("drops the date when the window has no first point", () => {
    expect(formatTrendDelta(-6, undefined)).toBe("−6");
  });
});
