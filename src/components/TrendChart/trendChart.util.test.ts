import { describe, it, expect } from "vitest";
import { formatTrendX, scoreGradeDetail, ticksForDomain } from "./trendChart.util";

describe("scoreGradeDetail", () => {
  it("names the letter grade a score maps to, at the band edges", () => {
    expect(scoreGradeDetail(90)).toBe("Grade A");
    expect(scoreGradeDetail(89)).toBe("Grade B");
    expect(scoreGradeDetail(49)).toBe("Grade F");
  });
});

// Noon UTC keeps the calendar day the same in every timezone a test runs in.
const SEP_18_NOON = String(Date.UTC(2026, 8, 18, 12, 0, 0) / 1000);

describe("formatTrendX", () => {
  it("formats an epoch-seconds string as a short month and day on the axis", () => {
    expect(formatTrendX(SEP_18_NOON, "axis")).toBe("Sep 18");
  });

  it("adds the time of day in the tooltip, where two scans can share a day", () => {
    expect(formatTrendX(SEP_18_NOON, "tooltip")).toMatch(/^Sep 18, \d{1,2}:\d{2}\s?(AM|PM)$/);
  });

  it("formats a calendar day without shifting it across timezones", () => {
    expect(formatTrendX("2026-08-01", "axis")).toBe("Aug 1");
    expect(formatTrendX("2026-08-01", "tooltip")).toBe("Aug 1");
  });

  it("returns anything it cannot read as a date unchanged", () => {
    expect(formatTrendX("week 3", "axis")).toBe("week 3");
    expect(formatTrendX("", "tooltip")).toBe("");
  });

  it("returns a number as its string form", () => {
    expect(formatTrendX(4, "axis")).toBe("4");
  });
});

describe("ticksForDomain", () => {
  it("gives a 0–100 score axis five evenly spaced ticks", () => {
    expect(ticksForDomain([0, 100])).toEqual([0, 25, 50, 75, 100]);
  });

  it("leaves an open-ended domain to the chart's own tick logic", () => {
    expect(ticksForDomain([0, "auto"])).toBeUndefined();
    expect(ticksForDomain(["dataMin", "dataMax"])).toBeUndefined();
  });

  it("spaces any fixed numeric domain in quarters", () => {
    expect(ticksForDomain([0, 40])).toEqual([0, 10, 20, 30, 40]);
  });
});
