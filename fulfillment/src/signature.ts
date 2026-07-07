/**
 * Standard Webhooks signature verification (https://www.standardwebhooks.com/).
 * Polar signs `order.paid` (and every other) webhook with HMAC-SHA256 over
 * `<webhook-id>.<webhook-timestamp>.<body>`, keyed by a base64 (optionally
 * `whsec_`-prefixed) secret, and rejects/replays are guarded by the
 * `webhook-timestamp` header (+/- 5 minutes tolerance).
 *
 * We use the reference `standardwebhooks` package rather than hand-rolling
 * this: it's pure JS (HMAC via `fast-sha256`, base64 via `@stablelib/base64`,
 * no Buffer/node:* imports), so it runs unmodified in the Workers runtime.
 */
import { Webhook, WebhookVerificationError } from "standardwebhooks";

export interface WebhookHeaders {
  "webhook-id": string;
  "webhook-timestamp": string;
  "webhook-signature": string;
}

export class SignatureVerificationError extends Error {}

/**
 * Verify `payload` (the raw request body string) against the given headers
 * and secret. Returns the parsed JSON body on success; throws
 * `SignatureVerificationError` on a bad/missing signature or an
 * out-of-tolerance timestamp (replay/expiry protection).
 */
export function verifyWebhookSignature(
  secret: string,
  payload: string,
  headers: WebhookHeaders
): unknown {
  const wh = new Webhook(secret);
  try {
    return wh.verify(payload, headers);
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      throw new SignatureVerificationError(err.message);
    }
    throw err;
  }
}
