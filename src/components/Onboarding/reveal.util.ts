import type { FileRow, SetupView } from "@/lib/ipc";
import { costThreshold } from "@/screens/Setup/setup.util";
import { setupFilterCounts } from "@/screens/Setup/setupFilter.util";
import { setupRows } from "@/screens/Setup/setupRows.util";

const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/** "84 items across 9 projects · 3 never used · 1 erroring" (spec §12); zero counts are left out. */
export function revealLine(items: number, projects: number, never: number, erroring: number): string {
  const parts = [`${n(items, "item", "items")} across ${n(projects, "project", "projects")}`];
  if (never > 0) parts.push(`${never} never used`);
  if (erroring > 0) parts.push(`${erroring} erroring`);
  return parts.join(" · ");
}

/** The fallback when the setup cannot be read: only the scan's own totals are true, and they count files, not items. */
export function scanTotalsLine(files: number, projects: number): string {
  return `Scanned ${n(files, "file", "files")} across ${n(projects, "project", "projects")}`;
}

/** The reveal line for a freshly scanned setup, counted by the rules Setup's summary line uses. */
export function setupRevealLine(setup: SetupView, files: FileRow[]): string {
  const rows = setupRows(setup, files);
  const counts = setupFilterCounts(rows, costThreshold(rows));
  return revealLine(rows.length, setup.projects.length, counts.never, counts.errors);
}
