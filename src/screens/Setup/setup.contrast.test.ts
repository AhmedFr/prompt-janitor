import { describe, it, expect } from "vitest";
import { AA_CONTRAST, contrastRatio } from "@/lib/contrast";

/**
 * The header chips' two backgrounds, mirrored from `Setup.css`.
 *
 * Composited by hand here for the same reason `usageBadge.contrast.test.ts`
 * does it: jsdom resolves no custom properties and composites no alpha, so a
 * test against computed styles would prove nothing. Change one and this test
 * fails until the CSS comment (and the CSS itself) follows.
 *
 * - `harnessChip`: `.setup-harness` — `--text-2` (#6e6e73) on the opaque
 *   `--card` (#ffffff).
 * - `scanChip`: `.setup-harness--scan` — the same text on `--group`
 *   (#f5f5f7), the borderless variant holding the last-scan recency.
 *
 * Everything else on this screen is `DataTable`/`Tabs` chrome, measured by
 * `dataTable.contrast.test.ts` and `tabs.contrast.test.ts`.
 */
const PAIRS: Record<string, { bg: string; fg: string }> = {
  harnessChip: { bg: "#ffffff", fg: "#6e6e73" },
  scanChip: { bg: "#f5f5f7", fg: "#6e6e73" },
};

describe("Setup header chip contrast", () => {
  it.each(Object.entries(PAIRS))("%s clears AA", (_name, { bg, fg }) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });
});
