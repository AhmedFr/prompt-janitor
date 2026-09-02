import { verifyWebhookSignature, SignatureVerificationError, type WebhookHeaders } from "./signature";
import { mintLicenseKey } from "./mint";
import { sendLicenseEmail } from "./email";
import type { Env, PolarOrderData, PolarWebhookEvent } from "./types";

/** Polar retries webhooks for a while; keep the idempotency marker well past that. */
const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * The plan minted for the configured Pro product (the only product at launch;
 * see docs/superpowers/specs polar-fulfillment design, §2). A second product
 * needs its own entry here and its own product-id gate — never a fallthrough.
 */
const PRO_PLAN = "pro";

function idempotencyKey(webhookId: string): string {
  return `webhook:${webhookId}`;
}

type MarkerStatus = "processing" | "sent";

interface IdempotencyMarker {
  status: MarkerStatus;
  ts: number;
}

function serializeMarker(status: MarkerStatus): string {
  const marker: IdempotencyMarker = { status, ts: Date.now() };
  return JSON.stringify(marker);
}

/**
 * Pull the buyer's email out of a Polar order defensively: Polar's
 * documented shape is `data.customer.email`, but we also try a couple of
 * fallback paths in case the payload shape varies (e.g. guest checkout
 * fields). Returns `null` if nothing usable is found, which routes the
 * event to the manual-fallback lane instead of throwing.
 */
export function extractBuyerEmail(data: PolarOrderData): string | null {
  const candidates: unknown[] = [
    data.customer?.email,
    data.customer?.email_address,
    data.customer_email,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.includes("@")) {
      return candidate;
    }
  }
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }

    const payload = await request.text();
    const headers: WebhookHeaders = {
      "webhook-id": request.headers.get("webhook-id") ?? "",
      "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
      "webhook-signature": request.headers.get("webhook-signature") ?? "",
    };

    let event: PolarWebhookEvent;
    try {
      event = verifyWebhookSignature(env.POLAR_WEBHOOK_SECRET, payload, headers) as PolarWebhookEvent;
    } catch (err) {
      if (err instanceof SignatureVerificationError) {
        return new Response("invalid signature", { status: 401 });
      }
      throw err;
    }

    if (event.type !== "order.paid") {
      return new Response("ignored: not order.paid", { status: 202 });
    }

    const webhookId = headers["webhook-id"];
    const key = webhookId ? idempotencyKey(webhookId) : null;

    // Product gate. Polar posts every product's orders to this endpoint, so
    // "paid" alone is not "bought Pro": a $0 test SKU, the Field Guide sold
    // on its own, or a 100 % discount code would otherwise mint a perpetual
    // Pro key. Fail closed when the var is missing — a misconfigured deploy
    // must not hand out licenses. No idempotency marker is written for
    // ignored events; there is nothing to dedupe.
    const proProductId = env.POLAR_PRO_PRODUCT_ID?.trim() ?? "";
    if (!proProductId) {
      console.error("POLAR_PRO_PRODUCT_ID is not configured; refusing to mint", {
        webhookId,
        orderId: event.data?.id,
      });
      return new Response("license product not configured; nothing minted", { status: 202 });
    }
    const productId = typeof event.data?.product_id === "string" ? event.data.product_id : null;
    if (productId !== proProductId) {
      console.error("order.paid is not for the licensed product; ignored", {
        webhookId,
        orderId: event.data?.id,
        productId,
      });
      return new Response("ignored: order is not for the licensed product", { status: 202 });
    }

    const email = extractBuyerEmail(event.data);
    if (!email) {
      // No marker is written here on purpose: this event never entered the
      // mint/email path, so there's nothing to dedupe against, and writing
      // one would wrongly suppress a later delivery that *does* carry a
      // usable email (e.g. Polar backfills the field on retry).
      console.error("order.paid webhook has no extractable buyer email; manual fallback needed", {
        webhookId,
        orderId: event.data?.id,
      });
      return new Response("no buyer email found; routed to manual fallback", { status: 202 });
    }

    if (key) {
      // Optimistic-lock ordering: write the marker BEFORE minting/emailing,
      // not after. Workers KV has no compare-and-swap, so this read-then-write
      // is still racy in principle — two deliveries could both read `null`
      // in the tiny window between the `get` and the `put` below. What this
      // buys us is collapsing that window from "the entire mint + network
      // email round-trip" (can be seconds, which is exactly the retry
      // spacing Polar's at-least-once delivery uses) down to two back-to-back
      // KV calls (milliseconds). That eliminates the realistic race without
      // adding a Durable Object or D1 for a pre-launch product. A marker
      // present with either status ("processing" or "sent") means some
      // delivery already owns this webhook-id, so we bail here.
      const existing = await env.FULFILLMENT_KV.get(key);
      if (existing) {
        return new Response("already processed", { status: 202 });
      }
      await env.FULFILLMENT_KV.put(key, serializeMarker("processing"), {
        expirationTtl: IDEMPOTENCY_TTL_SECONDS,
      });
    }

    let licenseKey: string;
    try {
      licenseKey = await mintLicenseKey(env.LICENSE_SIGNING_KEY, {
        email,
        plan: PRO_PLAN,
      });
    } catch (err) {
      // Never log the key material itself — just enough to diagnose a bad
      // secret rotation (e.g. LICENSE_SIGNING_KEY set to the wrong length
      // or wrong encoding).
      console.error("license signing key misconfigured; minting failed", { webhookId });
      if (key) {
        // Release the lock so a retry (after the secret is fixed) isn't
        // wrongly suppressed by a "processing" marker that will never
        // resolve.
        await env.FULFILLMENT_KV.delete(key);
      }
      return new Response("license signing misconfigured", { status: 500 });
    }

    const emailResponse = await sendLicenseEmail(env.RESEND_API_KEY, email, licenseKey);
    if (!emailResponse.ok) {
      const body = await emailResponse.text().catch(() => "<unreadable body>");
      console.error("Resend send failed", emailResponse.status, body);
      if (key) {
        // Release the lock so Polar's retry can actually resend, instead of
        // permanently suppressing this webhook-id for the 30-day TTL.
        await env.FULFILLMENT_KV.delete(key);
      }
      // Non-2xx so Polar retries the webhook.
      return new Response("email delivery failed", { status: 502 });
    }

    if (key) {
      await env.FULFILLMENT_KV.put(key, serializeMarker("sent"), {
        expirationTtl: IDEMPOTENCY_TTL_SECONDS,
      });
    }

    return new Response("ok", { status: 202 });
  },
};
