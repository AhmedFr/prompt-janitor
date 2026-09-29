import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { TrendChart, formatTrendDelta, scoreGradeDetail } from "@/components/TrendChart";
import { CHART_HEIGHT } from "./GradePopover.constants";
import type { FixResult, GradePopoverViewProps } from "./GradePopover.types";
import "./GradePopover.css";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Presentational popover: trigger, card, and the fix action's own busy/result state. */
export function GradePopoverView({ grade, state, onFix, onOpenChange }: GradePopoverViewProps) {
  const [open, setOpenState] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<FixResult | null>(null);
  const root = useRef<HTMLSpanElement>(null);

  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
    if (!next) setResult(null);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
    // setOpen only closes over stable props; re-binding on `open` is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (grade === null) return null;

  const { trend, openFindings, fixable, loading } = state;
  const delta = trend.length > 1 ? trend[trend.length - 1].score - trend[0].score : 0;

  const fix = async () => {
    setBusy(true);
    try {
      setResult(await onFix());
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="grade-popover" ref={root}>
      <button
        type="button"
        className={`summary-grade grade-popover__trigger grade-tint--${grade.toLowerCase()}`}
        aria-label={`Grade ${grade}, show health trend`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        {grade}
      </button>
      {open && (
        <div className="grade-popover__card" role="dialog" aria-label="Health trend">
          {trend.length > 0 && (
            <>
              <TrendChart data={trend} height={CHART_HEIGHT} valueDetail={scoreGradeDetail} />
              <div className="muted grade-popover__delta">{formatTrendDelta(delta, trend[0]?.t)}</div>
            </>
          )}
          <div className="grade-popover__findings">
            {loading && trend.length === 0 ? "Loading…" : plural(openFindings, "open finding", "open findings")}
          </div>
          {fixable > 0 && !result && (
            <Button variant="primary" size="sm" disabled={busy} onClick={() => void fix()}>
              {busy ? "Fixing…" : `Fix ${plural(fixable, "issue", "issues")} automatically`}
            </Button>
          )}
          {result && (
            <div role="status" className="grade-popover__result">
              {result.edits === 0
                ? "Nothing to fix"
                : `Fixed ${plural(result.edits, "issue", "issues")} in ${plural(result.files, "file", "files")}`}
            </div>
          )}
        </div>
      )}
    </span>
  );
}
