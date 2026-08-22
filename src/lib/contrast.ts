/**
 * WCAG 2.1 contrast maths, so "this label is readable on that tint" is a fact a
 * test can assert rather than a judgement call made once in a design tool.
 */

/** The smallest ratio WCAG 2.1 accepts for body-sized text (SC 1.4.3, AA). */
export const AA_CONTRAST = 4.5;

/** `#abc` / `#aabbcc` → `[r, g, b]` in 0–255. Throws on anything else. */
export function parseHex(hex: string): [number, number, number] {
  const body = hex.trim().replace(/^#/, "");
  const full =
    body.length === 3
      ? body
          .split("")
          .map((c) => c + c)
          .join("")
      : body;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a hex colour: ${hex}`);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** One sRGB channel (0–255) linearised, per WCAG's relative-luminance formula. */
function linearise(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance of a hex colour, 0 (black) to 1 (white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(linearise);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two hex colours, 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
