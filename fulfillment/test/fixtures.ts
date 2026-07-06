import { Webhook } from "standardwebhooks";
import { base64UrlDecode, base64UrlEncode } from "../src/mint";

/** A fixed test secret (base64, no prefix needed — the library accepts either). */
export const TEST_WEBHOOK_SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSwvbekpNJvA6VjSuF9CVKG9w==";

/**
 * The exact fixture used by `src-tauri/src/license.rs`'s own tests:
 * `SigningKey::from_bytes(&[7u8; 32])`. Reusing it here means our minted
 * output can be directly compared to what `license-tool` produces for the
 * same seed (see fulfillment/README.md "Parity test vector").
 */
export const TEST_SIGNING_SEED = new Uint8Array(32).fill(7);
export const TEST_SIGNING_SEED_B64URL = base64UrlEncode(TEST_SIGNING_SEED);

/**
 * Independently reproduced (not reused from mint.ts) verifier for the PJ1
 * scheme, mirroring `license::verify_with` in `src-tauri/src/license.rs`
 * bit-for-bit: split on the first two `.`, base64url-decode payload and
 * signature, Ed25519-verify the raw payload bytes, then parse JSON.
 * A separate implementation from `mintLicenseKey` on purpose, so the mint
 * tests aren't just checking a function against itself.
 */
export async function verifyLicenseKey(
  license: string,
  publicKeyRaw: Uint8Array
): Promise<{ email: string; plan: string } | null> {
  if (!license.startsWith("PJ1.")) return null;
  const rest = license.slice("PJ1.".length);
  const firstDot = rest.indexOf(".");
  if (firstDot === -1) return null;
  const payloadB64 = rest.slice(0, firstDot);
  const sigB64 = rest.slice(firstDot + 1);

  let payloadBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    payloadBytes = base64UrlDecode(payloadB64);
    sigBytes = base64UrlDecode(sigB64);
  } catch {
    return null;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    publicKeyRaw,
    { name: "Ed25519" },
    false,
    ["verify"]
  );
  const ok = await crypto.subtle.verify("Ed25519", key, sigBytes, payloadBytes);
  if (!ok) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (typeof parsed?.email !== "string" || typeof parsed?.plan !== "string") return null;
    return { email: parsed.email, plan: parsed.plan };
  } catch {
    return null;
  }
}

/** Derive the raw 32-byte Ed25519 public key for a given seed (test-only helper). */
export async function publicKeyFromSeed(seed: Uint8Array): Promise<Uint8Array> {
  const prefix = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
  ]);
  const der = new Uint8Array(prefix.length + seed.length);
  der.set(prefix, 0);
  der.set(seed, prefix.length);
  const priv = await crypto.subtle.importKey("pkcs8", der, { name: "Ed25519" }, true, ["sign"]);
  const jwk = (await crypto.subtle.exportKey("jwk", priv)) as JsonWebKey;
  if (!jwk.x) throw new Error("expected exported jwk to include public key (x)");
  return base64UrlDecode(jwk.x);
}

export interface SignedRequestFixture {
  payload: string;
  headers: {
    "webhook-id": string;
    "webhook-timestamp": string;
    "webhook-signature": string;
  };
}

/** Build a Standard-Webhooks-signed request body + headers for a given JSON body. */
export function signWebhookBody(
  secret: string,
  body: unknown,
  opts: { id?: string; timestamp?: Date } = {}
): SignedRequestFixture {
  const id = opts.id ?? "msg_test_1";
  const timestamp = opts.timestamp ?? new Date();
  const payload = JSON.stringify(body);
  const wh = new Webhook(secret);
  const signature = wh.sign(id, timestamp, payload);
  return {
    payload,
    headers: {
      "webhook-id": id,
      "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "webhook-signature": signature,
    },
  };
}

/** A minimal in-memory stand-in for the KV binding used in tests. */
export class MemoryKV {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string, _opts?: { expirationTtl?: number }): Promise<void> {
    this.store.set(key, value);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }
}

/** A well-formed Polar `order.paid` payload fixture, deep-overridable. */
export function orderPaidEvent(overrides: {
  email?: string | null;
  type?: string;
  orderId?: string;
} = {}): unknown {
  return {
    type: overrides.type ?? "order.paid",
    data: {
      id: overrides.orderId ?? "order_test_1",
      product_id: "prod_test_pro",
      customer:
        overrides.email === null
          ? null
          : {
              email: overrides.email ?? "buyer@example.com",
            },
    },
  };
}
