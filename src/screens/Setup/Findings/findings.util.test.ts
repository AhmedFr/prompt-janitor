import { describe, expect, it } from "vitest";
import type { FileDetail } from "@/lib/ipc";
import { findingKeys, weakestTwo } from "./findings.util";

describe("weakestTwo", () => {
  it("names the two lowest dimensions, ties in their fixed order", () => {
    expect(weakestTwo([
      { dimension: "Clarity", score: 80 }, { dimension: "Consistency", score: 40 },
      { dimension: "Structure", score: 40 }, { dimension: "Examples", score: 90 }, { dimension: "Format", score: 70 },
    ])).toBe("Consistency & Structure");
  });
});

type Issue = FileDetail["issues"][number];
const issue = (title: string, line: number | null): Issue =>
  ({ title, line, source: "anthropic", severity: "hi", why: "", fix_from: null, fix_to: null }) as Issue;

describe("findingKeys", () => {
  it("names a finding by its file, source, title and line, not its position", () => {
    const [a] = findingKeys("/f", [issue("Wrong package manager", 2)]);
    const [, b] = findingKeys("/f", [issue("No examples", null), issue("Wrong package manager", 2)]);
    expect(a).toBe(b);
  });

  it("tells apart two identical findings, so every key is unique", () => {
    const keys = findingKeys("/f", [issue("Vague", 3), issue("Vague", 3)]);
    expect(new Set(keys).size).toBe(2);
  });

  it("never shares a key across files", () => {
    expect(findingKeys("/a", [issue("X", 1)])[0]).not.toBe(findingKeys("/b", [issue("X", 1)])[0]);
  });
});
