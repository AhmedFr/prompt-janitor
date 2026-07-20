import { describe, expect, it } from "vitest";
import { mintLicenseKey, encodeLicensePayload, base64UrlEncode } from "../src/mint";
import { TEST_SIGNING_SEED, TEST_SIGNING_SEED_B64URL, publicKeyFromSeed, verifyLicenseKey } from "./fixtures";

describe("mintLicenseKey", () => {
  it("produces a key that verifies against the corresponding public key", async () => {
    const pub = await publicKeyFromSeed(TEST_SIGNING_SEED);
    const license = await mintLicenseKey(TEST_SIGNING_SEED_B64URL, {
      email: "someone@example.com",
      plan: "pro",
    });

    const info = await verifyLicenseKey(license, pub);

    expect(info).toEqual({ email: "someone@example.com", plan: "pro" });
  });

  it("rejects a key verified against a different signer's public key", async () => {
    const otherSeed = new Uint8Array(32).fill(9);
    const otherPub = await publicKeyFromSeed(otherSeed);
    const license = await mintLicenseKey(TEST_SIGNING_SEED_B64URL, {
      email: "someone@example.com",
      plan: "pro",
    });

    const info = await verifyLicenseKey(license, otherPub);

    expect(info).toBeNull();
  });

  it("rejects a payload tampered after minting (signature no longer matches)", async () => {
    const pub = await publicKeyFromSeed(TEST_SIGNING_SEED);
    const license = await mintLicenseKey(TEST_SIGNING_SEED_B64URL, {
      email: "someone@example.com",
      plan: "pro",
    });
    const forgedPayload = base64UrlEncode(encodeLicensePayload({ email: "evil@example.com", plan: "pro" }));
    const sig = license.split(".")[2];
    const forged = `PJ1.${forgedPayload}.${sig}`;

    const info = await verifyLicenseKey(forged, pub);

    expect(info).toBeNull();
  });

  /**
   * PARITY TEST VECTOR — cross-checked against the real vendor CLI.
   *
   * Seed: 32 bytes of 0x07 (the exact fixture `src-tauri/src/license.rs`'s
   * own tests use: `SigningKey::from_bytes(&[7u8; 32])`).
   *
   * Running the vendor CLI from origin/feat/67-license-vendor-tool with
   * that seed (base64url `BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc`)
   * written to a key file:
   *
   *   license-tool mint --key <seed-file> --email dev@example.com --plan pro
   *
   * printed exactly:
   *
   *   PJ1.eyJlbWFpbCI6ImRldkBleGFtcGxlLmNvbSIsInBsYW4iOiJwcm8ifQ.Fi3UjQbmBKAoNsX7oP-PxXUYbJNpI6SH7hXd_Q78bsj-m0WFO3UxAgPEe9tIyXN7OdUJHFW18jk2MDHu0H3xAg
   *
   * — byte-for-byte identical to what `mintLicenseKey` below produces. This
   * was independently re-derived a third way with Python's `cryptography`
   * library (Ed25519, same seed/payload) and matched too. If this test ever
   * fails, treat it as a scheme break, not a flaky assertion — re-run the
   * vendor CLI with the same seed and compare before changing this vector.
   */
  it("matches the vendor CLI's output for a known seed + email + plan", async () => {
    expect(TEST_SIGNING_SEED_B64URL).toBe("BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc");

    const license = await mintLicenseKey(TEST_SIGNING_SEED_B64URL, {
      email: "dev@example.com",
      plan: "pro",
    });

    expect(license).toBe(
      "PJ1.eyJlbWFpbCI6ImRldkBleGFtcGxlLmNvbSIsInBsYW4iOiJwcm8ifQ" +
        ".Fi3UjQbmBKAoNsX7oP-PxXUYbJNpI6SH7hXd_Q78bsj-m0WFO3UxAgPEe9tIyXN7OdUJHFW18jk2MDHu0H3xAg"
    );
  });
});
