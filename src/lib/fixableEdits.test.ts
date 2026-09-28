import { describe, expect, it } from "vitest";
import type { FileDetail } from "@/lib/ipc";
import { fixableEdits } from "./fixableEdits";

describe("fixableEdits", () => {
  it("collects only findings that carry a deterministic fix", () => {
    const detail = { issues: [
      { fix_from: "npm", fix_to: "pnpm" }, { fix_from: null, fix_to: null }, { fix_from: "a", fix_to: null },
    ] } as unknown as FileDetail;
    expect(fixableEdits(detail)).toEqual([{ from: "npm", to: "pnpm" }]);
  });

  it("returns nothing for a clean file", () => {
    expect(fixableEdits({ issues: [] } as unknown as FileDetail)).toEqual([]);
  });
});
