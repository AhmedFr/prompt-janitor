import { describe, expect, it } from "vitest";
import { defaultMode, fileStats, formatBytes, modesFor } from "./fileViewer.util";

describe("modesFor", () => {
  it("offers a rendered view only for markdown", () => {
    expect(modesFor("markdown")).toEqual(["rendered", "source"]);
    expect(modesFor("json")).toEqual(["source"]);
    expect(modesFor("text")).toEqual(["source"]);
  });
});

describe("defaultMode", () => {
  it("opens markdown rendered and everything else as source", () => {
    expect(defaultMode("markdown")).toBe("rendered");
    expect(defaultMode("json")).toBe("source");
    expect(defaultMode("text")).toBe("source");
  });
});

describe("formatBytes", () => {
  it("counts bytes, then KB with one decimal, then whole KB, then MB", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(812)).toBe("812 B");
    expect(formatBytes(4200)).toBe("4.1 KB");
    expect(formatBytes(48_000)).toBe("47 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

describe("fileStats", () => {
  it("counts lines the way the source view numbers them", () => {
    expect(fileStats("a\nb\nc")).toBe("3 lines · 5 B");
    // The trailing newline ends line 2; it does not open a line 3.
    expect(fileStats("a\nb\n")).toBe("2 lines · 4 B");
  });

  it("counts no lines in an empty file", () => {
    expect(fileStats("")).toBe("0 lines · 0 B");
  });

  it("says 'line' for one", () => {
    expect(fileStats("only")).toBe("1 line · 4 B");
  });

  it("measures bytes as UTF-8, not string length", () => {
    // "é" is one UTF-16 unit and two UTF-8 bytes — the Size column's unit.
    expect(fileStats("é")).toBe("1 line · 2 B");
  });

  it("groups thousands in a long file's line count", () => {
    expect(fileStats(Array.from({ length: 5000 }, () => "x").join("\n"))).toMatch(/^5,000 lines/);
  });
});
