import { describe, expect, it } from "vitest";
import { revealLine, scanTotalsLine, setupRevealLine } from "./reveal.util";
import type { SetupView } from "@/lib/ipc";

describe("revealLine", () => {
  it("reads like the spec's example", () => {
    expect(revealLine(84, 9, 3, 1)).toBe("84 items across 9 projects · 3 never used · 1 erroring");
  });
  it("drops zero counts and uses singulars", () => {
    expect(revealLine(1, 1, 0, 0)).toBe("1 item across 1 project");
  });
});

const artifact = (name: string, kind: string, errorRate: number | null = null) => ({
  name,
  kind,
  usage: errorRate == null ? null : { error_rate: errorRate, avg_turn_tokens: null },
});

describe("scanTotalsLine", () => {
  it("says files, not items, since the scan counted files", () => {
    expect(scanTotalsLine(5, 2)).toBe("Scanned 5 files across 2 projects");
    expect(scanTotalsLine(1, 1)).toBe("Scanned 1 file across 1 project");
  });
});

describe("setupRevealLine", () => {
  it("counts rows, projects, unused usage-kinds only, and erroring rows", () => {
    const setup = {
      harnesses: [],
      global: [artifact("rules", "rule"), artifact("s1", "skill")],
      projects: [
        { path: "/a", artifacts: [artifact("s2", "skill", 0.5), artifact("h", "hook")] },
      ],
    } as unknown as SetupView;
    // 4 rows, 1 project; never used: s1 only (instruction/hook have no usage); erroring: s2.
    expect(setupRevealLine(setup, [])).toBe("4 items across 1 project · 1 never used · 1 erroring");
  });
});
