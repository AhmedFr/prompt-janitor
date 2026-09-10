import type { Frontmatter } from "./SkillPanel.types";

/** The fence that opens and closes a frontmatter block. */
const FENCE = "---";
/** `key: value`, where the key is a bare word and everything after the first colon is the value. */
const FIELD = /^([A-Za-z0-9_-]+):\s*(.*)$/;

/**
 * Splits a skill file into its frontmatter fields and its markdown body.
 *
 * This is not a YAML parser and must not become one. A `SKILL.md` header is a
 * flat list of scalars — `name`, `description`, sometimes `allowed-tools` — and
 * the panel shows them as a key/value strip. Anything more structured (a
 * nested list, a block scalar) is skipped rather than guessed at: a wrong value
 * displayed confidently is worse than a value not displayed.
 *
 * Nothing is ever dropped from the round trip. This function feeds the *read*
 * view only — the editor works on the raw file — so a header this cannot fully
 * describe still saves back byte for byte.
 */
export function splitFrontmatter(source: string): Frontmatter {
  const lines = source.split("\n");
  if (lines[0]?.trim() !== FENCE) return { fields: [], body: source };

  const end = lines.findIndex((line, i) => i > 0 && line.trim() === FENCE);
  // An unterminated block is not a header — it is a file that happens to start
  // with a rule. Showing the whole thing as body keeps every line visible.
  if (end === -1) return { fields: [], body: source };

  const fields: [string, string][] = [];
  for (const line of lines.slice(1, end)) {
    const field = FIELD.exec(line);
    if (field) fields.push([field[1], unquote(field[2].trim())]);
  }
  return { fields, body: lines.slice(end + 1).join("\n") };
}

/** Drops the matching quotes YAML allows around a scalar; leaves an unbalanced quote alone. */
function unquote(value: string): string {
  const quoted = /^"(.*)"$/.exec(value) ?? /^'(.*)'$/.exec(value);
  return quoted ? quoted[1] : value;
}
