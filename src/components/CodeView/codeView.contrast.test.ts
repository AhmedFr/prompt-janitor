import { describe, expect, it } from "vitest";
import { AA_CONTRAST, contrastRatio } from "@/lib/contrast";

/**
 * The syntax inks, mirrored from `tokens.css` (jsdom resolves no custom
 * properties, so the pairs are written out; change a colour there and this
 * fails until the number here follows).
 *
 * Code sits on the card's white, and under find it sits on the match and
 * current-match yellows — every ink has to stay readable on all three, or
 * searching for a string is what makes it illegible.
 */
const INKS = {
  keyword: "#9b2393",
  string: "#b31a14",
  number: "#1c00cf",
  attr: "#0b5a8a",
  comment: "#51606c",
  code: "#643820",
  punct: "#5c5c61",
  text: "#1d1d1f",
};

const GROUNDS = { card: "#ffffff", match: "#fff1a8", current: "#ffe066" };

describe("syntax colours", () => {
  for (const [ink, fg] of Object.entries(INKS)) {
    for (const [ground, bg] of Object.entries(GROUNDS)) {
      it(`${ink} clears AA on the ${ground}`, () => {
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_CONTRAST);
      });
    }
  }

  it("line numbers (--text-3) stay a quiet 3:1 on the card", () => {
    // The gutter is decoration for sighted readers and hidden from assistive
    // tech; it needs the non-text 3:1 floor, not text AA.
    expect(contrastRatio("#9a9aa0", GROUNDS.card)).toBeGreaterThanOrEqual(2.6);
  });
});
