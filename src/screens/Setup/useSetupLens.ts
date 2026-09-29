import { useCallback, useMemo } from "react";
import type { FileRow, SetupView } from "@/lib/ipc";
import { lensChoices } from "./lensChoices.util";
import type { SetupTargetControl } from "./Setup.types";

/** A lens path as the inventory spells it: `/repo/web/` and `/repo/web` are one project. */
const trimLens = (path: string | null | undefined): string | null =>
  path ? path.replace(/\/+$/, "") || "/" : null;

/**
 * Setup's one lens: the project it looks through, read from Setup's target
 * (a deep link, or Back). Every way in trims the path once, so a trailing
 * slash still finds its project and is never a second option. Turning the
 * lens is a new place (a push). The open item stays: the viewer remains
 * while the lens still shows its row, and `useOpenItem` drops it otherwise.
 */
export function useSetupLens({ value, change }: SetupTargetControl, data: SetupView | null, files: FileRow[]) {
  const lens = trimLens(value.lens);
  const onLens = useCallback(
    (path: string | null) =>
      change({ ...value, lens: trimLens(path) ?? undefined }, "push"),
    [value, change],
  );
  // `null` for a path only the grader knows: no strip, but the lens still narrows the rows.
  const lensProject = useMemo(
    () => (lens && data ? (data.projects.find((p) => trimLens(p.path) === lens) ?? null) : null),
    [lens, data],
  );
  const choices = useMemo(() => (data ? lensChoices(data.projects, files, lens) : []), [data, files, lens]);
  return { lens, lensProject, choices, onLens };
}
