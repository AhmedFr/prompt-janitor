import { describe, it, expect } from "vitest";
import { buildGroups } from "./usePromptsList";
import type { FileRow, ProjectRow } from "@/lib/ipc";

const proj = (id: string, name: string, grade: ProjectRow["grade"], issues = 0): ProjectRow => ({
  id, name, grade, score: 50, file_count: 0, issue_count: issues, logo: null, modified: "100",
});
const file = (id: string, projectId: string, project: string, kind: string, grade: FileRow["grade"], issues = 0, modified = "100"): FileRow => ({
  id, name: kind, path: `/x/${project}/${kind}`, project, project_id: projectId, kind, grade, score: 50, issue_count: issues, modified,
});

const F = {
  tab: "all", search: "", provider: null, grade: null, sort: "grade",
} as const;

describe("buildGroups", () => {
  const projects = [proj("/a", "api", "D", 11), proj("/b", "web", "A", 0)];
  const files = [
    file("/a/CLAUDE.md", "/a", "api", "CLAUDE.md", "D", 5),
    file("/b/AGENTS.md", "/b", "web", "AGENTS.md", "A", 0),
  ];

  it("groups files under their project, worst grade first", () => {
    const groups = buildGroups(files, projects, { ...F });
    expect(groups.map((g) => g.project.name)).toEqual(["api", "web"]);
    expect(groups[0].files).toHaveLength(1);
  });

  it("flagged tab keeps only files with issues and non-empty groups", () => {
    const groups = buildGroups(files, projects, { ...F, tab: "flagged" });
    expect(groups.map((g) => g.project.name)).toEqual(["api"]);
  });

  it("provider filter keeps only matching kinds", () => {
    const groups = buildGroups(files, projects, { ...F, provider: "AGENTS.md" });
    expect(groups.map((g) => g.project.name)).toEqual(["web"]);
  });

  it("grade filter keeps only matching file grades", () => {
    const groups = buildGroups(files, projects, { ...F, grade: "A" });
    expect(groups.flatMap((g) => g.files).map((f) => f.id)).toEqual(["/b/AGENTS.md"]);
  });

  it("search matches file name, path, or project name", () => {
    const groups = buildGroups(files, projects, { ...F, search: "web" });
    expect(groups.map((g) => g.project.name)).toEqual(["web"]);
  });

  it("sort=issues orders groups by issue_count desc", () => {
    const groups = buildGroups(files, projects, { ...F, sort: "issues" });
    expect(groups[0].project.name).toBe("api");
  });
});
