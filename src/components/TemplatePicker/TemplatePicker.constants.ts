/** Display order + label for each stack a template pack covers. */
export const STACKS = ["react-ts", "python", "rust"] as const;

const STACK_LABELS: Record<string, string> = {
  "react-ts": "React + TypeScript",
  python: "Python",
  rust: "Rust",
};

/** Human label for a stack id, falling back to the raw id for forward-compat. */
export function stackLabel(stack: string): string {
  return STACK_LABELS[stack] ?? stack;
}
