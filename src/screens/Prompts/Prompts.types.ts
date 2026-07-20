import type { FileRow, ProjectRow, Grade } from "@/lib/ipc";

export type PromptTab = "all" | "flagged";
export type PromptSort = "grade" | "issues" | "recent";

export interface PromptFilters {
  tab: PromptTab;
  search: string;
  provider: string | null; // file kind, or null for any
  grade: Grade | null;
  sort: PromptSort;
}

export interface ProjectGroup {
  project: ProjectRow;
  files: FileRow[];
}
