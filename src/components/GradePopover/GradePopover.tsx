import { useState } from "react";
import { GradePopoverView } from "./GradePopoverView";
import { useGradePopover } from "./useGradePopover";
import type { GradePopoverProps } from "./GradePopover.types";
import type { Grade } from "@/lib/ipc";

/** The hook path: loads lazily, once the view reports it opened. */
function LiveGradePopover({ grade }: { grade: Grade | null }) {
  const [open, setOpen] = useState(false);
  const { runFix, ...state } = useGradePopover(open);
  return <GradePopoverView grade={grade} state={state} onFix={runFix} onOpenChange={setOpen} />;
}

/**
 * The grade badge as a popover trigger: the 90-day health trend, the open
 * findings, and "Fix N issues automatically" (spec §4.2). `state` and `onFix`
 * are the story/test override that bypasses the hook.
 */
export function GradePopover({ grade, state, onFix }: GradePopoverProps) {
  if (state) {
    return <GradePopoverView grade={grade} state={state} onFix={onFix ?? (async () => ({ files: 0, edits: 0 }))} />;
  }
  return <LiveGradePopover grade={grade} />;
}
