import { describe, it, expect } from "vitest";
import type { PanelFix } from "@/lib/ipc";
import { deltaCopy, fixLabel, lastScanLine, signalTone, verdictFor } from "./panel.util";

describe("verdictFor", () => {
  it("calls A and B good enough", () => {
    expect(verdictFor("A")).toBe("Good enough");
    expect(verdictFor("B")).toBe("Good enough");
  });

  it("calls C needs work", () => {
    expect(verdictFor("C")).toBe("Needs work");
  });

  /** D and F are the same call to action: the setup is actively costing the user. */
  it("calls D and F fix now", () => {
    expect(verdictFor("D")).toBe("Fix now");
    expect(verdictFor("F")).toBe("Fix now");
  });
});

describe("deltaCopy", () => {
  it("points up when the score rose", () => {
    expect(deltaCopy(3)).toBe("▲ 3 since last scan");
  });

  /** The sign is carried by the arrow, so the number itself is unsigned. */
  it("points down with an unsigned number when the score fell", () => {
    expect(deltaCopy(-2)).toBe("▼ 2 since last scan");
  });

  it("says so plainly when nothing moved", () => {
    expect(deltaCopy(0)).toBe("No change");
  });
});

describe("signalTone", () => {
  it("is ok at zero", () => {
    expect(signalTone(0)).toBe("ok");
  });

  it("turns error as soon as there is one", () => {
    expect(signalTone(1)).toBe("error");
    expect(signalTone(12)).toBe("error");
  });
});

describe("fixLabel", () => {
  /**
   * The row shows name, project, grade and issue count in four columns; the
   * label has to carry all four, because a screen reader gets the label alone.
   */
  it("names the file, its project, its grade and its issue count", () => {
    const fix: PanelFix = {
      file_id: "/code/acme-api/CLAUDE.md",
      name: "CLAUDE.md",
      project_name: "acme-api",
      grade: "D",
      issue_count: 4,
    };
    expect(fixLabel(fix)).toBe("Open CLAUDE.md in acme-api — grade D, 4 issues");
  });

  it("agrees the issue count with its noun", () => {
    const fix: PanelFix = {
      file_id: "/code/web-app/AGENTS.md",
      name: "AGENTS.md",
      project_name: "web-app",
      grade: "F",
      issue_count: 1,
    };
    expect(fixLabel(fix)).toBe("Open AGENTS.md in web-app — grade F, 1 issue");
  });
});

describe("lastScanLine", () => {
  it("dates the answer relative to now", () => {
    const now = new Date("2026-08-23T12:00:00.000Z");
    expect(lastScanLine("2026-08-23T10:00:00.000Z", now)).toBe("Scanned 2h ago");
  });

  /** "Scanned never" reads like a bug, so the empty case gets its own line. */
  it("says never scanned rather than scanned never", () => {
    expect(lastScanLine(null)).toBe("Never scanned");
  });
});
