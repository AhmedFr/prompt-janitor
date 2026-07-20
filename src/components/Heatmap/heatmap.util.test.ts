import { describe, it, expect } from "vitest";
import { bucketFiles } from "./heatmap.util";
import type { FileRow } from "@/lib/ipc";

const f = (id: string, grade: FileRow["grade"], score: number): FileRow => ({
  id,
  name: id,
  path: id,
  project: "p",
  project_id: "/p",
  kind: "CLAUDE.md",
  grade,
  score,
  issue_count: 0,
  modified: "1",
});

describe("bucketFiles", () => {
  it("sorts squares best score first and counts by grade", () => {
    const { squares, legend } = bucketFiles([
      f("a", "F", 40),
      f("b", "A", 95),
      f("c", "C", 70),
    ]);
    expect(squares.map((s) => s.id)).toEqual(["b", "c", "a"]);
    expect(legend).toEqual([
      { grade: "A", count: 1 },
      { grade: "B", count: 0 },
      { grade: "C", count: 1 },
      { grade: "D", count: 0 },
      { grade: "F", count: 1 },
    ]);
  });
});
