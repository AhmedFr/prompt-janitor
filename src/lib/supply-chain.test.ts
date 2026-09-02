import { describe, expect, it } from "vitest";
import ciYml from "../../.github/workflows/ci.yml?raw";
import releaseYml from "../../.github/workflows/release.yml?raw";
import viteConfig from "../../vite.config.ts?raw";

/**
 * Guards from the pre-public security audit (findings M-4 and L-3).
 *
 * These read the repo's build configuration rather than app code: a mutable
 * action tag or a too-broad env prefix is a one-line regression that no unit
 * test of the app would ever notice. Files arrive as text through Vite's
 * `?raw` import so the suite needs neither Node APIs nor a second tsconfig.
 */
const workflows = { "ci.yml": ciYml, "release.yml": releaseYml };

describe("GitHub Actions are pinned to commit SHAs", () => {
  for (const [name, text] of Object.entries(workflows)) {
    it(`${name}: every \`uses:\` references a 40-hex SHA with a version comment`, () => {
      const uses = [...text.matchAll(/^\s*-?\s*uses:\s*(\S+)(.*)$/gm)];
      expect(uses.length).toBeGreaterThan(0);
      for (const [, ref, trailing] of uses) {
        // owner/repo@<sha>  # vX.Y.Z — the comment keeps the pin readable and
        // lets Dependabot bump the SHA and the comment together.
        expect(ref, `unpinned action: ${ref}`).toMatch(/^[\w.-]+\/[\w.-]+(\/[\w./-]+)?@[0-9a-f]{40}$/);
        expect(trailing.trim(), `missing version comment on ${ref}`).toMatch(/^#\s*\S+/);
      }
    });
  }

  it("ci.yml runs with a read-only token", () => {
    expect(ciYml).toMatch(/^permissions:\n\s+contents:\s*read\s*$/m);
  });

  it("release.yml builds inside a protected environment", () => {
    expect(releaseYml).toMatch(/^\s+environment:\s*release\s*$/m);
  });
});

describe("Vite env prefix", () => {
  it("does not expose TAURI_* (which would include the updater signing key at release time)", () => {
    const match = viteConfig.match(/envPrefix:\s*\[([^\]]*)\]/);
    expect(match, "vite.config.ts should declare an explicit envPrefix array").not.toBeNull();
    const prefixes = [...match![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(prefixes).not.toContain("TAURI_");
    expect(prefixes).toContain("TAURI_ENV_");
  });
});
