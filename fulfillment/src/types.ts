/** Cloudflare bindings + secrets, configured in wrangler.toml / `wrangler secret put`. */
export interface Env {
  FULFILLMENT_KV: KVNamespace;
  /** Standard Webhooks signing secret from the Polar webhook endpoint config. */
  POLAR_WEBHOOK_SECRET: string;
  /** base64url(32-byte Ed25519 seed) — same format `license-tool keygen` writes. */
  LICENSE_SIGNING_KEY: string;
  /** Resend API key. */
  RESEND_API_KEY: string;
  /**
   * Polar product id of the Pro license (a plain `[vars]` entry in wrangler.toml).
   * Every product in the org posts to the same webhook; only an order for this
   * product mints a key. Empty or unset fails closed — nothing is minted.
   */
  POLAR_PRO_PRODUCT_ID: string;
}

/**
 * The subset of a Polar `order.paid` webhook payload we read. Polar's real
 * payload has many more fields; everything else is ignored. Shaped loosely
 * (not exhaustively typed) because we deliberately read defensively — see
 * `extractBuyerEmail` in `index.ts`.
 */
export interface PolarCustomer {
  email?: string | null;
  email_address?: string | null;
  [key: string]: unknown;
}

export interface PolarOrderData {
  id?: string;
  customer?: PolarCustomer | null;
  customer_email?: string | null;
  product_id?: string | null;
  [key: string]: unknown;
}

export interface PolarWebhookEvent {
  type: string;
  data: PolarOrderData;
  [key: string]: unknown;
}
