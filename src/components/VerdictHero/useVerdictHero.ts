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

/** Cap on simultaneous getFileDetail calls so large projects don't fan out unbounded. */
const DETAIL_FETCH_CONCURRENCY = 8;

/**
 * Run `fn` over `items` with at most `limit` calls in flight at once — a
 * small worker-pool so we don't need a dependency for this. Order of
 * results matches `items`; order of completion doesn't.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function countsOf(detail: FileDetail): SeverityCounts {
  const counts: SeverityCounts = { hi: 0, mid: 0, lo: 0 };
  for (const issue of detail.issues) counts[issue.severity] += 1;
  return counts;
}

/** A candidate fix-path row before its sequential point gain is known. */
export type FixCandidate = Omit<FixPathRow, "points">;

/**
 * Apply an ordered list of fix candidates one at a time against a running
 * per-file counts map, so each row's point gain reflects whatever's left of
 * that file's capped/diminishing marginal value once the earlier rows'
 * fixes are "claimed" — instead of every row scoring itself independently
 * against the pristine counts. Also returns the resulting per-file counts,
 * so a projected overall grade can be built from the same sequence.
 *
 * Exported for unit testing the derivation logic in isolation.
 */
export function applyFixesSequentially(
  candidates: FixCandidate[],
  countsById: Map<string, SeverityCounts>,
): { rows: FixPathRow[]; projected: Map<string, SeverityCounts> } {
  const projected = new Map<string, SeverityCounts>();
  const rows = candidates.map((candidate) => {
    const before =
      projected.get(candidate.fileId) ?? { ...(countsById.get(candidate.fileId) as SeverityCounts) };
    const points = pointsRecoverable(before, candidate.severity);
    const after = { ...before, [candidate.severity]: Math.max(0, before[candidate.severity] - 1) };
    projected.set(candidate.fileId, after);
    return { ...candidate, points };
  });
  return { rows, projected };
}

/**
 * Derive the fix path, projection and counts from the fetched files.
 * Exported for unit testing the derivation logic in isolation.
 */
export function compute(
  files: { id: string; score: number }[],
  details: FileDetail[],
): Pick<VerdictData, "fixPath" | "projectedGrade" | "fixesToA" | "autofixCount"> {
  const countsById = new Map(details.map((d) => [d.id, countsOf(d)]));

  // Every open issue, ranked Hi > Mid > Lo, then by points recoverable
  // against the pristine counts — this independent score only picks which
  // 3 issues lead the fix path, it isn't what gets displayed.
  const candidates: FixCandidate[] = details
    .flatMap((d) =>
      d.issues.map((issue) => ({
        fileId: d.id,
        fileName: d.name,
        title: issue.title,
        severity: issue.severity,
        rankPoints: pointsRecoverable(countsById.get(d.id) as SeverityCounts, issue.severity),
      })),
    )
    .sort((a, b) => SEV_RANK[a.severity] - SEV_RANK[b.severity] || b.rankPoints - a.rankPoints)
    .slice(0, 3)
    .map(({ fileId, fileName, title, severity }) => ({ fileId, fileName, title, severity }));

  // Walk the chosen fixes in order against a running counts map, so each
  // row's displayed points are the true marginal gain of applying it after
  // the rows before it — the same sequence the projection below is built from.
  const { rows: fixPath, projected } = applyFixesSequentially(candidates, countsById);

  // Projected overall grade with the fix-path issues removed: rebuild each
  // affected file's severity counts, rescore it, and re-average all files.
  let projectedGrade = null;
  if (fixPath.length > 0) {
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
  // Bumped on every refetch() call; a call only commits its results if it's
  // still the most recent one when its async work resolves, so an older
  // in-flight refetch (e.g. from mount) can't clobber a newer one's state
  // (e.g. from a scan finishing) landing first.
  const generationRef = useRef(0);

  const refetch = useCallback(async () => {
    const generation = ++generationRef.current;
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
    const detailResults = await mapWithConcurrency(
      files.filter((f) => f.issue_count > 0),
      DETAIL_FETCH_CONCURRENCY,
      (f) => commands.getFileDetail(f.id),
    );
    const details = detailResults
      .map((r) => (r.status === "ok" ? r.data : null))
      .filter((d): d is FileDetail => d != null);

    // A newer refetch started while this one was still fetching — drop
    // these now-stale results instead of overwriting fresher state.
    if (generation !== generationRef.current) return;

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
