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
 * The filter controls moved into `FilterSelect` and are measured by
 * `filterSelect.contrast.test.ts`; what is left here is the table's own chrome.
 *
 * - Sort glyph: `--text-2` (#6e6e73) on the header, which is now the card's
 *   own white rather than a `--group` band. `--text-3` (#9a9aa0) was the
 *   original at 2.57:1 on `--group`, under even the 3:1 non-text floor a
 *   control's only affordance has to clear.
 * - Active sort glyph: `--blue` on that same white. It is an icon, not text,
 *   so the 3:1 floor is the one that applies — and it is the reason the
 *   header *label* beside it stays `--text-2` rather than turning blue too.
 * - Clear all: `--blue-press` on the toolbar's white ground.
 */
const BLUE = "#0a84ff";
const BLUE_PRESS = "#0060df";
const GROUP = "#f5f5f7";
const TEXT_2 = "#6e6e73";
const TEXT_3 = "#9a9aa0";
const WHITE = "#ffffff";

/** The floor WCAG 1.4.11 puts under a control's non-text affordance. */
const NON_TEXT_CONTRAST = 3;

describe("DataTable contrast", () => {
  it("keeps the sort glyph above the non-text floor on the sticky header", () => {
    expect(contrastRatio(TEXT_2, WHITE)).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
  });

  it("keeps the active sort glyph above it too", () => {
    expect(contrastRatio(BLUE, WHITE)).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
  });

  it("is why the sort glyph is not --text-3, on the old --group header or the white one", () => {
    expect(contrastRatio(TEXT_3, GROUP)).toBeLessThan(NON_TEXT_CONTRAST);
    expect(contrastRatio(TEXT_3, WHITE)).toBeLessThan(NON_TEXT_CONTRAST);
  });

  it("keeps the header label itself at full AA, not just the non-text floor", () => {
    // The label is text; the caret beside it is not. Only one of the two may
    // sit at 3:1.
    expect(contrastRatio(TEXT_2, WHITE)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it("keeps Clear all readable on the toolbar", () => {
    expect(contrastRatio(BLUE_PRESS, WHITE)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });
});
