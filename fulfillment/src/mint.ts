/**
 * Mints `PJ1.<payload>.<sig>` license keys, byte-for-byte compatible with the
 * app's offline verifier (`src-tauri/src/license.rs`) and the vendor CLI's
 * `license::mint_with` (`src-tauri/src/bin/license_tool.rs`, PR #69):
 *
 *   - payload is the JSON object `{"email":…,"plan":…}`, keys in that exact
 *     order (a `{ email, plan }` object literal serializes in insertion
 *     order in `JSON.stringify`, matching serde's declared field order for
 *     `struct Payload { email: String, plan: String }`), compact (no
 *     whitespace) — matching `serde_json::to_vec`.
 *   - the signature is Ed25519 over the raw UTF-8 payload bytes (not a hash
 *     of them).
 *   - both the payload and the signature are base64url-encoded, no padding
 *     (`URL_SAFE_NO_PAD` on the Rust side).
 *
 * This scheme was cross-checked against the actual vendor CLI binary while
 * building this worker (see fulfillment/README.md "Parity test vector") —
 * not just re-derived from reading the source.
 */

const PREFIX = "PJ1.";

/**
 * A minimal RFC 8410 PKCS#8 DER envelope for a raw 32-byte Ed25519 private
 * key ("seed"). WebCrypto's `importKey` only accepts private keys in
 * `pkcs8` (or `jwk`) format, never a bare raw seed — but the PKCS#8 wrapper
 * for Ed25519 is a fixed 16-byte prefix followed by the seed, so we build it
 * by hand instead of pulling in an ASN.1 library. The vendor CLI's `keygen`
 * command writes exactly this bare base64url seed to disk/secret, so this
 * wrapping happens only on the worker side.
 */
const PKCS8_ED25519_PREFIX = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlDecode(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function seedToPkcs8(seed: Uint8Array): Uint8Array {
  if (seed.length !== 32) {
    throw new Error(`Ed25519 signing key seed must be 32 bytes, got ${seed.length}`);
  }
  const der = new Uint8Array(PKCS8_ED25519_PREFIX.length + seed.length);
  der.set(PKCS8_ED25519_PREFIX, 0);
  der.set(seed, PKCS8_ED25519_PREFIX.length);
  return der;
}

/** Import the `LICENSE_SIGNING_KEY` secret (base64url seed) as a signing key. */
export async function importSigningKey(signingKeySeedB64Url: string): Promise<CryptoKey> {
  const seed = base64UrlDecode(signingKeySeedB64Url);
  const pkcs8 = seedToPkcs8(seed);
  return crypto.subtle.importKey("pkcs8", pkcs8, { name: "Ed25519" }, false, ["sign"]);
}

export interface LicensePayload {
  email: string;
  plan: string;
}

/** Build the exact compact JSON bytes that get signed — order matters. */
export function encodeLicensePayload(payload: LicensePayload): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ email: payload.email, plan: payload.plan }));
}

/**
 * Mint a `PJ1.…` license key for `payload`, signed with the Ed25519 key
 * derived from `signingKeySeedB64Url` (the `LICENSE_SIGNING_KEY` secret).
 */
export async function mintLicenseKey(
  signingKeySeedB64Url: string,
  payload: LicensePayload
): Promise<string> {
  const key = await importSigningKey(signingKeySeedB64Url);
  const payloadBytes = encodeLicensePayload(payload);
  const signature = await crypto.subtle.sign("Ed25519", key, payloadBytes);
  return `${PREFIX}${base64UrlEncode(payloadBytes)}.${base64UrlEncode(new Uint8Array(signature))}`;
}
