import type { ArtifactView, FileRow, ProjectSetup, SetupView } from "@/lib/ipc";
import { KIND_CHIP_ORDER } from "@/lib/vocabulary";

/** Where a row came from: the harness inventory, or a graded file the inventory never saw. */
export type RowOrigin = "inventory" | "graded";

/**
 * One row of the Setup table. The inventory is not the whole story: files the
 * grader found in an extra scan folder (15 of 37 on the owner's machine) have
 * no inventory row, and deleting Prompts must not make them vanish — they
 * join as instructions of their project.
 */
export interface SetupRow extends ArtifactView {
  origin: RowOrigin;
  /** Project name for a graded-only row, whose path no inventory project may know. */
  project_label: string | null;
  /** Owning project root, or `null` for global and plugin rows. */
  project_path: string | null;
  /** Position in the lens's load order (Part 4); `null` outside the lens. */
  load_order: number | null;
}

/** A stable, always-negative id for a row with no `artifacts.id` (djb2 over the file id). */
export function syntheticId(fileId: string): number {
  let h = 5381;
  for (let i = 0; i < fileId.length; i++) h = ((h << 5) + h + fileId.charCodeAt(i)) | 0;
  return -(Math.abs(h) + 1);
}

/** Builds a Setup row for a graded file the inventory never scanned. */
function fromGraded(f: FileRow): SetupRow {
  return {
    id: syntheticId(f.id),
    harness: "",
    layer: "project",
    kind: "rule",
    name: f.name,
    path: f.path,
    plugin_name: null,
    description: null,
    bytes: 0,
    grade: f.grade,
    score: f.score,
    file_id: f.id,
    usage: null,
    issue_count: f.issue_count,
    worst_severity: f.worst_severity,
    origin: "graded",
    project_label: f.project,
    project_path: f.project_id,
    load_order: null,
  };
}

/**
 * Every Setup row: the harness inventory (global, then each project's
 * artifacts), followed by graded files no inventory row already points at —
 * so a file the grader found but the harness scanner didn't is never lost.
 */
export function setupRows(setup: SetupView, files: FileRow[]): SetupRow[] {
  const inventory: SetupRow[] = [
    ...setup.global.map((a) => ({
      ...a,
      origin: "inventory" as const,
      project_label: null,
      project_path: null,
      load_order: null,
    })),
    ...setup.projects.flatMap((p) =>
      p.artifacts.map((a) => ({
        ...a,
        origin: "inventory" as const,
        project_label: null,
        project_path: p.path,
        load_order: null,
      })),
    ),
  ];
  const known = new Set(inventory.map((r) => r.file_id).filter((id): id is string => id !== null));
  const graded = files.filter((f) => !known.has(f.id)).map(fromGraded);
  return [...inventory, ...graded];
}

const KIND_RANK = new Map(KIND_CHIP_ORDER.map((k, i) => [k, i]));

/** Every slice's default order (spec §4.4): kind in chip order, then name, case-insensitive. */
export function byKindThenName(rows: SetupRow[]): SetupRow[] {
  return [...rows].sort(
    (a, b) =>
      (KIND_RANK.get(a.kind) ?? 0) - (KIND_RANK.get(b.kind) ?? 0) ||
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

/** Where an item is loaded: a global or plugin item in every project still on disk, a project item in its own. */
export function loadedInFor(row: SetupRow, projects: ProjectSetup[]): { path: string; name: string }[] {
  const live = projects.filter((p) => p.exists);
  const where = row.layer === "project" ? live.filter((p) => p.path === row.project_path) : live;
  return where.map((p) => ({ path: p.path, name: p.name }));
}
