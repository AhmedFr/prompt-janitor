import { describe, it, expect } from "vitest";
import { AA_CONTRAST, contrastRatio } from "@/lib/contrast";

/**
 * The `--tone-*` status pairs, mirrored from `tokens.css`.
 *
 * A test that read live computed styles would prove nothing in jsdom (no
 * custom properties resolved, no alpha composited), so the pairs are
 * hard-coded and the CSS comment names this file. Change one and this fails
 * until the other follows.
 *
 * Used by SummaryLine, the missing-folder chip, ItemViewer, Sheet, cells and
 * PanelSignals as text on the tone's own opaque tint.
 */
const TONES: Record<string, { tint: string; fg: string }> = {
  never: { tint: "#f2f2f4", fg: "#5c5c61" },
  error: { tint: "#ffe7e6", fg: "#992620" },
  stale: { tint: "#fef1dd", fg: "#7a4a00" },
};

describe("status tone palette", () => {
  it.each(Object.entries(TONES))("%s text clears AA on its own tint", (_tone, { tint, fg }) => {
    expect(contrastRatio(fg, tint)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it("keeps every tone legible on the white card surface behind the tint too", () => {
    for (const { fg } of Object.values(TONES)) {
      expect(contrastRatio(fg, "#ffffff")).toBeGreaterThanOrEqual(AA_CONTRAST);
    }
  });
});
