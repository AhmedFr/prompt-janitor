import { describe, expect, it } from "vitest";
import license from "../../LICENSE?raw";
import rootPkg from "../../package.json";
import landingPkg from "../../landing/package.json";
import fulfillmentPkg from "../../fulfillment/package.json";

/**
 * The repo is public under AGPL-3.0 (audit finding I-1). Every package that
 * ships from it must say so in the same words, and the LICENSE file at the
 * root must be the real text, not a placeholder.
 */
describe("repository license", () => {
  it("carries the AGPL-3.0 text at the root", () => {
    expect(license).toMatch(/GNU AFFERO GENERAL PUBLIC LICENSE\s+Version 3/);
    expect(license).toMatch(/TERMS AND CONDITIONS/);
  });

  it.each([
    ["package.json", rootPkg],
    ["landing/package.json", landingPkg],
    ["fulfillment/package.json", fulfillmentPkg],
  ])("%s declares AGPL-3.0-only", (_name, pkg) => {
    expect((pkg as { license?: string }).license).toBe("AGPL-3.0-only");
  });
});
