/** The confirmation line (spec §16), exact; singular for one project. Only asked when n ≥ 1. */
export function removalWarning(n: number): string {
  const what = n === 1 ? "1 project and its history" : `${n} projects and their history`;
  return `Removes ${what} from Prompt Janitor. Files on disk are not touched.`;
}
