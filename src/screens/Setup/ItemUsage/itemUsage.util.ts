import type { UsageDay } from "@/lib/ipc";

/** Errors ÷ uses per day as a whole percentage (spec §6.3); `null` where nothing ran, so the chart shows a gap and the tooltip "—". */
export function errorRatePerDay(perDay: UsageDay[]): { day: string; rate: number | null }[] {
  return perDay.map(({ day, uses, errors }) => ({ day, rate: uses > 0 ? Math.round((errors / uses) * 100) : null }));
}
