import { describe, it, expect } from "vitest";
import { AA_CONTRAST, contrastRatio } from "@/lib/contrast";

/**
 * The toned cell pairs, mirrored from `tokens.css` / `cells.css`.
 *
 * Composited by hand for the reason `dataTable.contrast.test.ts` gives: jsdom
 * resolves no custom properties and composites no alpha. Change a colour in
 * the CSS and this fails until the numbers here follow.
 *
 * A toned number sits on a row, and a row has three grounds: the card's white
 * at rest, `--group` under the pointer, and `--blue-tint` over white (#e2f0ff)
 * when selected. Every rate tone has to clear AA on all three, or hovering a
 * bad row is what makes it unreadable.
 */
const WHITE = "#ffffff";
const GROUP = "#f5f5f7";
const SELECTED = "#e2f0ff";
const ROW_GROUNDS = { rest: WHITE, hover: GROUP, selected: SELECTED };

const RATE_TONES = {
  good: "#1d7a3a", // --tone-good-fg
  watch: "#7a4a00", // --tone-stale-fg
  bad: "#992620", // --tone-error-fg
};

/**
 * The muted "—" is `--text-2`, the same ink as every path and description in
 * the table. It clears AA at rest and on hover; on the transient
 * `--dt__row--highlight` tint it measures 4.38:1, a gap every muted cell in
 * the app shares, pinned here so it cannot silently get worse.
 */
const MUTED = "#6e6e73";

/** Scope badges: foreground on its own opaque tint. */
const SCOPE_BADGES = {
  global: { fg: "#0060df", bg: SELECTED }, // --blue-press on --blue-tint over white
  project: { fg: "#0b6b5e", bg: "#dff3ef" }, // --scope-project-fg / -tint
  plugin: { fg: "#4a3aa7", bg: "#eeebfa" }, // --scope-plugin-fg / -tint
};

describe("toned cell contrast", () => {
  for (const [tone, fg] of Object.entries(RATE_TONES)) {
    for (const [state, ground] of Object.entries(ROW_GROUNDS)) {
      it(`keeps a ${tone} rate readable on a ${state} row`, () => {
        expect(contrastRatio(fg, ground)).toBeGreaterThanOrEqual(AA_CONTRAST);
      });
    }
  }

  it("keeps the muted unknown mark at AA on a resting and a hovered row", () => {
    expect(contrastRatio(MUTED, WHITE)).toBeGreaterThanOrEqual(AA_CONTRAST);
    expect(contrastRatio(MUTED, GROUP)).toBeGreaterThanOrEqual(AA_CONTRAST);
  });

  it("pins the muted mark's known shortfall on the highlighted row", () => {
    expect(contrastRatio(MUTED, SELECTED)).toBeGreaterThan(4.3);
  });

  for (const [layer, { fg, bg }] of Object.entries(SCOPE_BADGES)) {
    it(`keeps the ${layer} scope badge readable on its tint`, () => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_CONTRAST);
    });
  }

  it("is why good is not the brand --green, which is a fill colour, not ink", () => {
    expect(contrastRatio("#2fb457", WHITE)).toBeLessThan(AA_CONTRAST);
  });
});
