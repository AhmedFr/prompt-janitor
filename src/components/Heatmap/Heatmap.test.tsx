import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Heatmap } from "./Heatmap";
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

describe("Heatmap", () => {
  afterEach(cleanup);

  it("renders one square per file and calls onSelect", () => {
    const onSelect = vi.fn();
    const { container } = render(
      <Heatmap
        files={[
          f("a", "A", 95),
          f("b", "F", 30),
        ]}
        onSelect={onSelect}
      />
    );
    const items = container.querySelectorAll(".heatmap__sq");
    expect(items).toHaveLength(2);
    (items[0] as HTMLButtonElement).click();
    expect(onSelect).toHaveBeenCalledWith("a");
  });
});
