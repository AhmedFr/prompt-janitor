import { describe, expect, it } from "vitest";
import type { ProjectRow } from "@/lib/ipc";
import { projectsRemovedBy, removalWarning } from "./folders.util";

const project = (id: string, harness: string | null = null) => ({ id, harness }) as ProjectRow;

// One case per counting test of `replace_extra_folders` (src-tauri/src/scan_folders.rs),
// same paths, so the warning and the backend can never disagree. (`persists_the_new_list`
// counts nothing and has no counterpart.)
describe("projectsRemovedBy", () => {
  it("removing_a_folder_drops_the_projects_only_it_covered", () => {
    expect(projectsRemovedBy("/side", ["/work"], [project("/work/api"), project("/side/blog")])).toBe(1);
  });

  it("keeps_a_project_a_harness_still_works_in", () => {
    expect(projectsRemovedBy("/side", [], [project("/side/blog", "claude_code")])).toBe(0);
  });

  it("keeps_a_repo_root_a_harness_works_somewhere_inside", () => {
    // A session in /side/mono/apps/web resolves to the root /side/mono, whose row carries the harness.
    expect(projectsRemovedBy("/side", [], [project("/side/mono", "claude_code")])).toBe(0);
  });

  it("keeps_a_project_under_a_folder_that_remains", () => {
    expect(projectsRemovedBy("/side", ["/side/blog"], [project("/side/blog")])).toBe(0);
  });

  it("a_sibling_with_a_shared_prefix_is_not_inside", () => {
    expect(projectsRemovedBy("/side", ["/sidecar"], [project("/sidecar/app")])).toBe(0);
  });

  it("adding_a_folder_drops_nothing: a folder with no project in it removes none", () => {
    expect(projectsRemovedBy("/side", [], [project("/work/api")])).toBe(0);
  });

  it("keeps a project a remaining folder sits inside (the other direction)", () => {
    expect(projectsRemovedBy("/side", ["/side/mono/apps"], [project("/side/mono")])).toBe(0);
  });
});

describe("removalWarning", () => {
  it("says exactly what the spec says, with the count", () => {
    expect(removalWarning(3)).toBe(
      "Removes 3 projects and their history from Prompt Janitor. Files on disk are not touched.",
    );
  });

  it("uses the singular for one project", () => {
    expect(removalWarning(1)).toBe(
      "Removes 1 project and its history from Prompt Janitor. Files on disk are not touched.",
    );
  });
});
