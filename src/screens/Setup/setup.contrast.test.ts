import { describe, it, expect } from "vitest";
import { AA_CONTRAST, contrastRatio } from "@/lib/contrast";

/**
 * The chip/kind count pill's two backgrounds, mirrored from `Setup.css`.
 *
 * Composited by hand here for the same reason `usageBadge.contrast.test.ts`
 * does it: jsdom resolves no custom properties and composites no alpha, so a
 * test against computed styles would prove nothing. Change one and this test
 * fails until the CSS comment (and the CSS itself) follows.
 *
 * - `onGroup`: the default pill — `--text-2` (#6e6e73) on the opaque
 *   `--group` (#f5f5f7) — used by both `.setup-chip__count` and
 *   `.setup-kind__count`.
 * - `onActiveChip`: the pill inside an active (`--on`) chip — white text
 *   (inherited from the chip) on `rgba(0, 0, 0, 0.18)` composited over
 *   `--blue` (#0a84ff), which works out to `#086cd1`.
 */
const PAIRS: Record<string, { bg: string; fg: string }> = {
  onGroup: { bg: "#f5f5f7", fg: "#6e6e73" },
  onActiveChip: { bg: "#086cd1", fg: "#ffffff" },
};

describe("Setup chip/kind count pill contrast", () => {
  it.each(Object.entries(PAIRS))("%s clears AA", (_name, { bg, fg }) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });
});
