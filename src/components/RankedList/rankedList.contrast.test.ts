import { describe, it, expect } from "vitest";
import { contrastRatio } from "@/lib/contrast";

/**
 * The bar-fill/track pair, mirrored from `tokens.css` / `RankedList.css`.
 *
 * Composited by hand here for the same reason `usageBadge.contrast.test.ts`
 * does it: jsdom resolves no custom properties and composites no alpha, so a
 * test against computed styles would prove nothing. Change one and this test
 * fails until the CSS comment (and the CSS itself) follows.
 *
 * `--bar-fill` is `rgba(0, 96, 223, 0.75)` (`--blue-press` at 75% alpha) over
 * the opaque `.rl__bar-track` background `--group` (#f5f5f7), which composites
 * to `#3d85e5`. `--bar-fill-error` is `rgba(153, 38, 32, 0.65)`
 * (`--tone-error-fg` at 65% alpha) over the same track, composited to
 * `#b96e6b`. `--blue-tint`/`--tone-error-tint` (~12% alpha) were the original
 * fills and only reached ~1.15:1 against the track — well under the 3:1 WCAG
 * 1.4.11 non-text-contrast floor a bar needs against its background.
 */
const PAIRS: Record<string, { fill: string; track: string }> = {
  default: { fill: "#3d85e5", track: "#f5f5f7" },
  error: { fill: "#b96e6b", track: "#f5f5f7" },
};

describe("RankedList bar-fill contrast", () => {
  it.each(Object.entries(PAIRS))("%s bar clears 3:1 against its track", (_variant, { fill, track }) => {
    expect(contrastRatio(fill, track)).toBeGreaterThanOrEqual(3.0);
  });
});
