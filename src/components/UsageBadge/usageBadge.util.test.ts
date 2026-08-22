import { describe, it, expect } from "vitest";
import { formatUsage } from "./usageBadge.util";

const now = new Date("2026-08-21T12:00:00Z");
const stat = (o: Partial<Parameters<typeof formatUsage>[0] & object>) => ({
  total: 42,
  sessions: 12,
  last_used: "2026-08-18T12:00:00.000Z",
  error_rate: 0,
  avg_turn_tokens: null,
  count_30d: 5,
  count_prev_30d: 3,
  ...o,
});

describe("formatUsage", () => {
  it("reads never used for null", () => {
    expect(formatUsage(null, now)).toEqual({ label: "never used", tone: "never" });
  });
  it("formats plural counts and relative days", () => {
    expect(formatUsage(stat({}), now).label).toBe("used 42× · 12 sessions · last 3d ago");
  });
  it("uses singulars and hours", () => {
    expect(
      formatUsage(stat({ total: 1, sessions: 1, last_used: "2026-08-21T09:30:00.000Z" }), now).label,
    ).toBe("used 1× · 1 session · last 2h ago");
  });
  it("flags error-prone and stale artifacts", () => {
    expect(formatUsage(stat({ error_rate: 0.5 }), now).tone).toBe("error");
    expect(formatUsage(stat({ last_used: "2026-05-01T00:00:00.000Z" }), now).tone).toBe("stale");
    expect(formatUsage(stat({ last_used: "2026-05-01T00:00:00.000Z" }), now).label).toMatch(/last 3mo ago$/);
  });

  it("says why an artifact is error-toned instead of leaving it to the colour", () => {
    expect(
      formatUsage(stat({ total: 40, sessions: 12, error_rate: 0.42 }), now).label,
    ).toBe("used 40× · 12 sessions · 42% errored");
  });

  it("says why an artifact is stale-toned instead of leaving it to the colour", () => {
    expect(
      formatUsage(
        stat({ total: 9, sessions: 4, last_used: "2026-04-21T12:00:00.000Z" }),
        now,
      ).label,
    ).toBe("used 9× · 4 sessions · stale, last 4mo ago");
  });
  it("omits the last-used suffix and stays 'used' toned when last_used is unknown", () => {
    expect(formatUsage(stat({ total: 3, sessions: 2, last_used: null }), now)).toEqual({
      label: "used 3× · 2 sessions",
      tone: "used",
    });
  });
});
