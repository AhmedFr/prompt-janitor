import { describe, it, expect } from "vitest";
import { AA_CONTRAST, contrastRatio } from "@/lib/contrast";

/**
 * The `FilterSelect` chrome pairs, mirrored from `tokens.css` /
 * `FilterSelect.css`. Composited by hand for the same reason
 * `dataTable.contrast.test.ts` does it: jsdom resolves no custom properties
 * and composites no alpha, so a test against computed styles would prove
 * nothing. Change a colour in the CSS and this test fails until the numbers
 * here (and the CSS comments quoting them) follow.
 *
 * An active trigger is tinted rather than filled — several groups can be on at
 * once, and a row of solid blue buttons reads as a row of alerts. The label is
 * what has to carry the state at full AA, so it goes `--blue-press` on the
 * composited tint.
 */
const BLUE = "#0a84ff";
const BLUE_PRESS = "#0060df";
/** `--blue-tint` — `rgba(10, 132, 255, 0.12)` — composited over `--card`. */
const ACTIVE_TRIGGER_BG = "#e2f0ff";
const CARD = "#ffffff";
const GROUP = "#f5f5f7";
const TEXT_2 = "#6e6e73";
const TEXT_3 = "#9a9aa0";
const WHITE = "#ffffff";

/** The floor WCAG 1.4.11 puts under a control's non-text affordance. */
const NON_TEXT_CONTRAST = 3;

describe("FilterSelect contrast", () => {
  it("keeps an active trigger's label at AA on its tint", () => {
    expect(contrastRatio(BLUE_PRESS, ACTIVE_TRIGGER_BG)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it("is why the active label is --blue-press rather than --blue", () => {
    expect(contrastRatio(BLUE, ACTIVE_TRIGGER_BG)).toBeLessThan(AA_CONTRAST);
  });

  it("keeps a resting trigger's label at AA", () => {
    expect(contrastRatio(TEXT_2, CARD)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it("keeps the caret above the non-text floor", () => {
    expect(contrastRatio(TEXT_2, CARD)).toBeGreaterThanOrEqual(NON_TEXT_CONTRAST);
  });

  it("is why the caret is not --text-3", () => {
    // The caret is the trigger's only sign that it opens anything, so it has
    // to clear the floor a control's non-text affordance is held to.
    expect(contrastRatio(TEXT_3, CARD)).toBeLessThan(NON_TEXT_CONTRAST);
  });

  it("keeps a ticked checkbox's tick at AA against its fill", () => {
    expect(contrastRatio(WHITE, BLUE_PRESS)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it("keeps an option's count readable on the highlighted row", () => {
    expect(contrastRatio(TEXT_2, GROUP)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it("keeps the Clear link at AA on the popover", () => {
    expect(contrastRatio(BLUE_PRESS, CARD)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });
});
