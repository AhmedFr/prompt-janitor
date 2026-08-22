import { describe, it, expect } from "vitest";
import { AA_CONTRAST, contrastRatio } from "@/lib/contrast";

/**
 * The count-badge pairs, mirrored from `tokens.css` / `Tabs.css`.
 *
 * Composited by hand — jsdom resolves no custom properties and composites no
 * alpha, so a test against computed styles would prove nothing (the same
 * reason `rankedList.contrast.test.ts` gives).
 *
 * An inactive badge is `--sep` (`rgba(0, 0, 0, 0.09)`) over the strip's
 * `--group` (#f5f5f7), which composites to #dfdfe1. `--text-2` (#6e6e73) on
 * that reaches 3.81:1 — the number is the whole point of the badge, so it
 * takes `--text` (#1d1d1f) instead. The active badge is `--blue-press` on
 * `--blue-tint` over the tab's white `--card`, composited to #e2f0ff.
 */
const INACTIVE_BADGE = "#dfdfe1";
const ACTIVE_BADGE = "#e2f0ff";
const TEXT = "#1d1d1f";
const TEXT_2 = "#6e6e73";
const BLUE_PRESS = "#0060df";
const GROUP = "#f5f5f7";

describe("Tabs contrast", () => {
  it("keeps an inactive tab's count badge at AA", () => {
    expect(contrastRatio(TEXT, INACTIVE_BADGE)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it("is why the inactive badge is not --text-2", () => {
    expect(contrastRatio(TEXT_2, INACTIVE_BADGE)).toBeLessThan(AA_CONTRAST);
  });

  it("keeps the active tab's count badge at AA", () => {
    expect(contrastRatio(BLUE_PRESS, ACTIVE_BADGE)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it("keeps an inactive tab's own label at AA on the strip", () => {
    expect(contrastRatio(TEXT_2, GROUP)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });
});
