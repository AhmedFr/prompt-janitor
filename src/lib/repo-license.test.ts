import { describe, expect, it } from "vitest";
import license from "../../LICENSE?raw";
import rootPkg from "../../package.json";
import landingPkg from "../../landing/package.json";
import fulfillmentPkg from "../../fulfillment/package.json";
import appCargo from "../../src-tauri/Cargo.toml?raw";
import licenseToolCargo from "../../src-tauri/license-tool/Cargo.toml?raw";
import benchmarkCargo from "../../benchmark/Cargo.toml?raw";

/**
 * The repo is public under AGPL-3.0 (audit finding I-1). Every package that
 * ships from it — npm and Cargo alike — must say so in the same words, and
 * the LICENSE file at the root must be the real text, not a placeholder.
 * (Not to be confused with the Ed25519 license *keys* the app verifies.)
 */
const SPDX = "AGPL-3.0-only";

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
    expect((pkg as { license?: string }).license).toBe(SPDX);
  });

  it.each([
    ["src-tauri/Cargo.toml", appCargo],
    ["src-tauri/license-tool/Cargo.toml", licenseToolCargo],
    ["benchmark/Cargo.toml", benchmarkCargo],
  ])("%s declares AGPL-3.0-only", (_name, toml) => {
    expect(toml).toMatch(new RegExp(`^license = "${SPDX}"$`, "m"));
  });
});
