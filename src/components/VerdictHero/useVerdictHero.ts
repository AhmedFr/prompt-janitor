import { useCallback, useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { commands, isTauri, type FileDetail, type Severity } from "@/lib/ipc";
import {
  fixesToReachA,
  gradeForScore,
  overallFromFileScores,
  pointsRecoverable,
  scoreForCounts,
  type SeverityCounts,
} from "@/lib/scoring";
import type { FixPathRow, VerdictData } from "./VerdictHero.types";

const EMPTY: VerdictData = {
  fixPath: [],
  projectedGrade: null,
  fixesToA: 0,
  autofixCount: 0,
  detStandards: 0,
  totalStandards: 0,
  entitled: false,
  aiReady: false,
  loading: true,
};

const SEV_RANK: Record<Severity, number> = { hi: 0, mid: 1, lo: 2 };

function countsOf(detail: FileDetail): SeverityCounts {
  const counts: SeverityCounts = { hi: 0, mid: 0, lo: 0 };
  for (const issue of detail.issues) counts[issue.severity] += 1;
  return counts;
}

/** Derive the fix path, projection and counts from the fetched files. */
function compute(
  files: { id: string; score: number }[],
  details: FileDetail[],
): Pick<VerdictData, "fixPath" | "projectedGrade" | "fixesToA" | "autofixCount"> {
  const countsById = new Map(details.map((d) => [d.id, countsOf(d)]));

  // Every open issue, ranked Hi > Mid > Lo, then by points recoverable.
  const ranked = details
    .flatMap((d) =>
      d.issues.map((issue) => ({
        fileId: d.id,
        fileName: d.name,
        title: issue.title,
        severity: issue.severity,
        points: pointsRecoverable(countsById.get(d.id) as SeverityCounts, issue.severity),
      })),
    )
    .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.points - a.points);
  const fixPath: FixPathRow[] = ranked.slice(0, 3);

  // Projected overall grade with the fix-path issues removed: rebuild each
  // affected file's severity counts, rescore it, and re-average all files.
  let projectedGrade = null;
  if (fixPath.length > 0) {
    const projected = new Map<string, SeverityCounts>();
    for (const row of fixPath) {
      const counts = projected.get(row.fileId) ?? { ...(countsById.get(row.fileId) as SeverityCounts) };
      counts[row.severity] = Math.max(0, counts[row.severity] - 1);
      projected.set(row.fileId, counts);
    }
    const scores = files.map((f) => {
      const counts = projected.get(f.id);
      if (!counts) return f.score;
      // Apply the delta to the stored score so unaffected penalties stay put.
      const before = countsById.get(f.id) as SeverityCounts;
      return f.score + (scoreForCounts(counts) - scoreForCounts(before));
    });
    projectedGrade = gradeForScore(overallFromFileScores(scores));
  }

  const allCounts = files.map(
    (f) => countsById.get(f.id) ?? ({ hi: 0, mid: 0, lo: 0 } as SeverityCounts),
  );
  const fixesToA = fixesToReachA(allCounts);

  const autofixCount = details.reduce(
    (n, d) => n + d.issues.filter((i) => i.fix_from && i.fix_to).length,
    0,
  );

  return { fixPath, projectedGrade, fixesToA, autofixCount };
}

/**
 * Fetches and derives everything the VerdictHero shows beyond the Overview
 * payload: the fix path + projection, standards coverage, entitlement, and
 * the cross-file Auto-fix action. Refetches after every scan.
 */
export function useVerdictHero() {
  const [verdict, setVerdict] = useState<VerdictData>(EMPTY);
  const [autoFixBusy, setAutoFixBusy] = useState(false);
  const detailsRef = useRef<FileDetail[]>([]);

  const refetch = useCallback(async () => {
    if (!isTauri) {
      setVerdict((v) => ({ ...v, loading: false }));
      return;
    }
    const [filesRes, rulesRes, cfgRes, entRes] = await Promise.all([
      commands.listFiles(),
      commands.listRules(),
      commands.getAiConfig(),
      commands.getEntitlement(),
    ]);
    const files = filesRes.status === "ok" ? filesRes.data : [];
    const detailResults = await Promise.all(
      files.filter((f) => f.issue_count > 0).map((f) => commands.getFileDetail(f.id)),
    );
    const details = detailResults
      .map((r) => (r.status === "ok" ? r.data : null))
      .filter((d): d is FileDetail => d != null);
    detailsRef.current = details;

    const rules = rulesRes.status === "ok" ? rulesRes.data.filter((r) => r.enabled) : [];
    setVerdict({
      ...compute(files, details),
      detStandards: rules.filter((r) => !r.nl).length,
      totalStandards: rules.length,
      entitled: entRes.status === "ok" && entRes.data.paid,
      aiReady: cfgRes.status === "ok" && cfgRes.data.provider !== "none" && cfgRes.data.has_key,
      loading: false,
    });
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  useEffect(() => {
    if (!isTauri) return;
    const unlisten = listen("scan-done", () => void refetch());
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refetch]);

  /** Apply every deterministic fix across all files, then rescan once. */
  const runAutoFix = useCallback(async () => {
    setAutoFixBusy(true);
    try {
      for (const detail of detailsRef.current) {
        const edits = detail.issues
          .filter((i) => i.fix_from && i.fix_to)
          .map((i) => ({ from: i.fix_from as string, to: i.fix_to as string }));
        if (edits.length > 0) await commands.applyFix(detail.id, edits, false);
      }
      const folder = await commands.getScanFolder();
      if (folder.status === "ok" && folder.data) await commands.scanNow(folder.data);
    } finally {
      setAutoFixBusy(false);
    }
  }, []);

  return { verdict, autoFixBusy, runAutoFix };
}
