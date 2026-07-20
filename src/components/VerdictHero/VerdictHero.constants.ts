import type { Grade } from "@/lib/ipc";

/** Pick the singular or plural form for a count — for nouns, verbs ("this"/"these"), etc. */
export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return n === 1 ? singular : pluralForm;
}

/**
 * The one-sentence verdict per grade. `{n}` (B only) is the computed number
 * of fixes needed for the overall score to reach an A (≥ 90).
 */
export const VERDICT_SENTENCES: Record<Grade, string> = {
  A: "Good enough. Your instruction files meet the bar.",
  B: "Close — {n} fixes from an A.",
  C: "Not yet. Your AI runs on C-grade instructions.",
  D: "Not good enough. Your AI runs on D-grade instructions.",
  F: "Failing. Your AI is working against broken instructions.",
};

/** Resolve the verdict sentence for a grade, filling in `{n}` for B. */
export function verdictSentence(grade: Grade, fixesToA: number): string {
  const sentence = VERDICT_SENTENCES[grade];
  if (fixesToA === 1) return sentence.replace("{n} fixes", "1 fix");
  return sentence.replace("{n}", String(fixesToA));
}

/** Honest cost framing, shown only when there are critical issues. */
export function costSentence(critical: number): string {
  const s = critical === 1 ? "" : "s";
  return `You pay for AI every month — ${critical} critical issue${s} degrading what it gives back.`;
}
