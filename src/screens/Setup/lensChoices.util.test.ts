import { describe, expect, it } from "vitest";
import type { FileRow, ProjectSetup } from "@/lib/ipc";
import { lensChoices } from "./lensChoices.util";

const project = (path: string, name: string, last: string | null): ProjectSetup => ({
  harness: "claude_code", path, name, exists: true, session_count: 1, last_session_at: last, artifacts: [],
});
const projects = [project("/code/web", "web", "2026-09-26T00:00:00Z"), project("/code/api", "api", null)];
const file = { id: "/side/AGENTS.md", path: "/side/AGENTS.md", project: "side-project", project_id: "/side" } as FileRow;

describe("lensChoices", () => {
  it("offers every inventory project, with its latest session", () => {
    expect(lensChoices(projects, [], null)).toEqual([
      { path: "/code/web", name: "web", lastSessionAt: "2026-09-26T00:00:00Z" },
      { path: "/code/api", name: "api", lastSessionAt: null },
    ]);
  });

  it("adds nothing for a lens on an inventory project", () => {
    expect(lensChoices(projects, [file], "/code/web")).toHaveLength(2);
  });

  it("adds a graded-only lens, named by its graded files' project", () => {
    expect(lensChoices(projects, [file], "/side")[2]).toEqual({ path: "/side", name: "side-project", lastSessionAt: null });
  });

  it("names a lens nothing knows by its folder", () => {
    expect(lensChoices(projects, [], "/not/known/")[2]).toEqual({ path: "/not/known/", name: "known", lastSessionAt: null });
  });
});
