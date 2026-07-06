import { verifyWebhookSignature, SignatureVerificationError, type WebhookHeaders } from "./signature";
import { mintLicenseKey } from "./mint";
import { sendLicenseEmail } from "./email";
import type { Env, PolarOrderData, PolarWebhookEvent } from "./types";

/** Polar retries webhooks for a while; keep the idempotency marker well past that. */
const IDEMPOTENCY_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

/** Only product at launch (see docs/superpowers/specs polar-fulfillment design, §2). */
const DEFAULT_PLAN = "pro";

function idempotencyKey(webhookId: string): string {
  return `webhook:${webhookId}`;
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
    if (webhookId) {
      const alreadyProcessed = await env.FULFILLMENT_KV.get(idempotencyKey(webhookId));
      if (alreadyProcessed) {
        return new Response("already processed", { status: 202 });
      }
    }

    const email = extractBuyerEmail(event.data);
    if (!email) {
      console.error("order.paid webhook has no extractable buyer email; manual fallback needed", {
        webhookId,
        orderId: event.data?.id,
      });
      return new Response("no buyer email found; routed to manual fallback", { status: 202 });
    }

    const licenseKey = await mintLicenseKey(env.LICENSE_SIGNING_KEY, {
      email,
      plan: DEFAULT_PLAN,
    });

    const emailResponse = await sendLicenseEmail(env.RESEND_API_KEY, email, licenseKey);
    if (!emailResponse.ok) {
      const body = await emailResponse.text().catch(() => "<unreadable body>");
      console.error("Resend send failed", emailResponse.status, body);
      // Non-2xx so Polar retries the webhook — do NOT record idempotency yet.
      return new Response("email delivery failed", { status: 502 });
    }

    if (webhookId) {
      await env.FULFILLMENT_KV.put(idempotencyKey(webhookId), "sent", {
        expirationTtl: IDEMPOTENCY_TTL_SECONDS,
      });
    }

    return new Response("ok", { status: 202 });
  },
};
