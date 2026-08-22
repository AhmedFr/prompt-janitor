import { describe, it, expect } from "vitest";
import { AA_CONTRAST, contrastRatio } from "@/lib/contrast";

/**
 * The badge's tone palette, mirrored from `tokens.css` / `UsageBadge.css`.
 *
 * A test that read the live computed styles would prove nothing in jsdom (it
 * resolves no custom properties and composites no alpha), so the pairs are
 * hard-coded here and the CSS comment carries the same numbers. Change one and
 * this test fails until the other follows.
 *
 * `used` is the one tone still expressed in the shared blue tokens:
 * `--blue-tint` is `rgba(10, 132, 255, 0.12)`, which over the white card
 * surface composites to `#e2f0ff`.
 */
const TONES: Record<string, { tint: string; fg: string }> = {
  used: { tint: "#e2f0ff", fg: "#0060df" },
  never: { tint: "#f2f2f4", fg: "#5c5c61" },
  error: { tint: "#ffe7e6", fg: "#992620" },
  stale: { tint: "#fef1dd", fg: "#7a4a00" },
};

describe("UsageBadge tone palette", () => {
  it.each(Object.entries(TONES))("%s text clears AA on its own tint", (_tone, { tint, fg }) => {
    expect(contrastRatio(fg, tint)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it("keeps every tone legible on the card surface behind the tint too", () => {
    // A badge sitting on a hovered row still shows near-white behind it, so the
    // foreground has to hold up against `--card` as well as against the tint.
    for (const { fg } of Object.values(TONES)) {
      expect(contrastRatio(fg, "#ffffff")).toBeGreaterThanOrEqual(AA_CONTRAST);
    }
  });
});
