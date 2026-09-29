import { useCallback, useEffect, useMemo, useState } from "react";
import type { SetupTarget } from "@/App/setupTarget";
import type { FileRow, SetupView } from "@/lib/ipc";
import { lensChoices } from "./lensChoices.util";

/** A lens path as the inventory spells it: `/repo/web/` and `/repo/web` are one project. */
const trimLens = (path: string | null | undefined): string | null =>
  path ? path.replace(/\/+$/, "") || "/" : null;

/**
 * Setup's one lens: the project it looks through, from a deep link or the
 * Viewing control. Every way in trims the path once, so a trailing slash
 * still finds its project and is never a second option.
 */
export function useSetupLens(target: SetupTarget | undefined, data: SetupView | null, files: FileRow[]) {
  const [lens, setLens] = useState<string | null>(() => trimLens(target?.lens));
  // A deep link names the lens it means, even when Setup is already mounted.
  useEffect(() => {
    if (target?.lens !== undefined) setLens(trimLens(target.lens));
  }, [target?.lens]);
  const onLens = useCallback((path: string | null) => setLens(trimLens(path)), []);
  // `null` for a path only the grader knows: no strip, but the lens still narrows the rows.
  const lensProject = useMemo(
    () => (lens && data ? (data.projects.find((p) => trimLens(p.path) === lens) ?? null) : null),
    [lens, data],
  );
  const choices = useMemo(() => (data ? lensChoices(data.projects, files, lens) : []), [data, files, lens]);
  return { lens, lensProject, choices, onLens };
}
