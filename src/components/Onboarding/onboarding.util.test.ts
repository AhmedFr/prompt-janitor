import { describe, it, expect } from "vitest";
import type { HarnessInfo } from "@/lib/ipc";
import { detectedSummary } from "./onboarding.util";

const harness = (o: Partial<HarnessInfo> = {}): HarnessInfo => ({
  id: "claude_code",
  display_name: "Claude Code",
  detected: true,
  last_scan_at: null,
  project_count: 12,
  session_count: 88,
  ...o,
});

describe("detectedSummary", () => {
  it("counts one setup per harness and sums their projects and sessions", () => {
    expect(detectedSummary([harness()])).toBe("1 global setup · 12 projects · 88 sessions");
    expect(
      detectedSummary([harness(), harness({ id: "other", project_count: 3, session_count: 1 })]),
    ).toBe("2 global setups · 15 projects · 89 sessions");
  });

  it("uses singular forms for a count of one", () => {
    expect(detectedSummary([harness({ project_count: 1, session_count: 1 })])).toBe(
      "1 global setup · 1 project · 1 session",
    );
  });

  it("reports nothing found for an empty list", () => {
    expect(detectedSummary([])).toBe("0 global setups · 0 projects · 0 sessions");
  });
});
