/**
 * The confirmation line (spec §16), exact; singular for one project. Only asked
 * when n ≥ 1. `null` means the backend could not say how many projects would go
 * (the preview failed): the removal still asks first, with a generic warning.
 */
export function removalWarning(n: number | null): string {
  if (n === null) {
    return "Removing this folder deletes its projects and their history from Prompt Janitor. Files on disk are not touched.";
  }
  const what = n === 1 ? "1 project and its history" : `${n} projects and their history`;
  return `Removes ${what} from Prompt Janitor. Files on disk are not touched.`;
}
