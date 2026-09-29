import type { FileDetail, FixEdit } from "@/lib/ipc";

/** Every deterministic fix on the file, as the edits `apply_fix` takes. */
export function fixableEdits(detail: FileDetail): FixEdit[] {
  return detail.issues
    .filter((i) => i.fix_from && i.fix_to)
    .map((i) => ({ from: i.fix_from as string, to: i.fix_to as string }));
}
