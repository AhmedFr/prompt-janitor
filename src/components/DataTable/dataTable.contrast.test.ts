import { describe, it, expect } from "vitest";
import { AA_CONTRAST, contrastRatio } from "@/lib/contrast";

/**
 * The `DataTable` chrome pairs, mirrored from `tokens.css` / `DataTable.css`.
 *
 * Composited by hand for the same reason `rankedList.contrast.test.ts` does
 * it: jsdom resolves no custom properties and composites no alpha, so a test
 * against computed styles would prove nothing. Change a colour in the CSS and
 * this test fails until the numbers here (and the CSS comments quoting them)
 * follow.
 *
 * - Pressed chip: white on `--blue-press` (#0060df). `--blue` (#0a84ff) was
 *   the original and reaches only 3.65:1 — enough for the chip's shape under
 *   1.4.11, short of AA for the label inside it.
 * - Pressed chip's count: white on `rgba(0, 0, 0, 0.18)` over `--blue-press`,
 *   which composites to #004fb7.
 * - Sort glyph: `--text-2` (#6e6e73) on the sticky header's `--group`
 *   (#f5f5f7). `--text-3` (#9a9aa0) was the original at 2.57:1, under even
 *   the 3:1 non-text floor a control's only affordance has to clear.
 * - Pill group label: `--text-2` on the toolbar's white ground.
 */
const BLUE = "#0a84ff";
const BLUE_PRESS = "#0060df";
const COUNT_PATCH = "#004fb7";
const GROUP = "#f5f5f7";
const TEXT_2 = "#6e6e73";
const TEXT_3 = "#9a9aa0";
const WHITE = "#ffffff";

/** The floor WCAG 1.4.11 puts under a control's non-text affordance. */
const NON_TEXT_CONTRAST = 3;

describe("DataTable contrast", () => {
  it("keeps a pressed chip's label at AA", () => {
    expect(contrastRatio(WHITE, BLUE_PRESS)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it("is why the pressed chip is not --blue", () => {
    expect(contrastRatio(WHITE, BLUE)).toBeLessThan(AA_CONTRAST);
  });

  it("keeps the count inside a pressed chip at AA", () => {
    expect(contrastRatio(WHITE, COUNT_PATCH)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it("keeps the sort glyph above the non-text floor on the sticky header", () => {
    expect(contrastRatio(TEXT_2, GROUP)).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
  });

  it("is why the sort glyph is not --text-3", () => {
    expect(contrastRatio(TEXT_3, GROUP)).toBeLessThan(NON_TEXT_CONTRAST);
  });

  it("keeps the pill group label readable on the toolbar", () => {
    expect(contrastRatio(TEXT_2, WHITE)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });
});
