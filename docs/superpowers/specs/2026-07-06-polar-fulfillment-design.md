# Prompt Janitor — Polar Checkout → License Key Fulfillment Design

- **Date:** 2026-07-06
- **Status:** Draft — pending owner review
- **Owner:** Ahmed ABOUELLEIL
- **Relates to:** #78 (checkout via merchant of record → license key delivery), #67/PR #69 (license vendor CLI), [`2026-07-02-lifetime-offer-design.md`](2026-07-02-lifetime-offer-design.md) (offer: $69 founder → $99, perpetual + 12 mo updates)
- **Research basis:** Polar docs as of 2026-07 (checkout links, benefits, webhooks, refunds, fees)

---

## 1. Decision summary

**Polar is the merchant of record, checkout, and purchase-event source — and nothing else.**
We do NOT use Polar's License Keys benefit, Custom benefit, or Feature Flag benefit for
the license itself. We mint and deliver our own offline `PJ1.` Ed25519 keys.

Why the built-ins are ruled out (verified against Polar docs):

| Polar feature | Why not |
|---|---|
| License Keys benefit | Key format is Polar-generated `PREFIX_UUID4` only (cannot carry our signed payload); validation is **online-only** (`POST /v1/license-keys/validate` on every check) — incompatible with the app's offline, no-account promise |
| Custom benefit | Static Markdown set at benefit-creation time; cannot hold a per-purchase computed value |
| Feature Flag benefit | Grant-level fields are not updatable post-purchase for this benefit type — no way to inject a minted key |
| File Downloads benefit | Same static file for every customer; no per-customer generation |

All three major MoRs (Polar, Lemon Squeezy, Paddle) converge on the same answer for
offline custom keys: **webhook → your own minting logic**. Polar stays the pick: cheapest
onboarding, Standard-Webhooks-signed events, scriptable product/checkout-link APIs.

## 2. Architecture (target state)

```
Buyer → Polar Checkout Link ($69 SKU, hosted checkout)
      → order.paid webhook (Standard Webhooks HMAC-signed)
      → Cloudflare Worker  "pj-fulfillment"
          1. verify webhook signature (webhook-id/-timestamp/-signature)
          2. idempotency check on webhook-id (KV; Polar is at-least-once, 10 retries)
          3. mint PJ1 key: Ed25519-sign {email, plan} — same scheme as the vendor CLI
          4. email the key via transactional API (Resend), from a template
          5. return 202 fast (Polar timeout is 10s; respond, then work if needed)
      → Buyer pastes key into Settings → License (offline verify, as shipped)
```

- **Secrets in the worker:** Ed25519 private key, Resend API key, Polar webhook secret.
  No database, no server, no accounts. Worker KV only for idempotency (TTL ~30 days).
- **Key minting parity:** the worker reuses the exact payload/signature scheme of the
  vendor CLI (PR #69). Ed25519 is available in Workers via WebCrypto; a parity test
  vector (same input → same key verifies against the app's embedded pubkey) is part of
  the implementation's acceptance criteria.
- **`plan` mapping:** derived from the Polar `product_id` on the order (one product at
  launch: `pro`). Founder-window pricing is just the product's price; no plan change.
- **success_url:** a `/thanks` page on the landing site: "Your license key is on its way
  to {email} — paste it into Settings → License. No account needed."

## 3. Launch sequencing (sell before automating)

1. **Day 1 — manual fulfillment, zero infra.** Create the Polar product + checkout link
   (dashboard), replace `polar_cl_PLACEHOLDER` in `landing/src/main.js` and
   `src/lib/monetization.ts`. On each `order.paid` email from Polar: mint a key with the
   vendor CLI, reply to the buyer. Viable at launch volume; buyer-visible delay is the
   only cost.
2. **Week 1–2 — the worker.** Ship `pj-fulfillment` (single-file Worker + tests). Point
   the Polar webhook at it. Manual flow remains the documented fallback (webhook
   endpoint auto-disables after 10 consecutive failures — Polar emails the org, and the
   dashboard can replay missed deliveries).
3. **Later (optional) —** script product/checkout-link creation via `POST /v1/products/`
   and `POST /v1/checkout-links/` for reproducibility.

## 4. Refunds & the 30-day guarantee

- Refunds are **vendor-initiated** (dashboard or `POST /v1/refunds/`); Polar allows them
  within **60 days** — comfortably covers our advertised 30-day letter-grade guarantee.
- The ~5% + $0.50 processing fee is **not returned** on refund (Starter plan); a refunded
  $69 sale costs ≈ $4.95. Acceptable; price it in.
- **Key revocation: none at launch.** Polar can't revoke a key it never issued, and the
  app is offline. For a $69 product this is an accepted risk (industry-standard stance
  for offline indie licenses). If abuse ever matters, a revoked-key list checked during
  the app's update check is the future hook — never a launch blocker.
- Guarantee operations: buyer emails support → check grade history claim loosely (trust
  by default) → refund in Polar, leave "revoke benefits" checkbox irrelevant (no Polar
  benefits attached).

## 5. Fees (Starter plan, org created ≥ 2026-05-27)

5% + $0.50 per transaction (+1.5% non-US cards) → **≈ $64 net on $69** before payout
fees ($2/mo active payout + 0.25% + $0.25 per payout). Upgrade to Pro ($20/mo, 3.8%)
only when volume makes it net-positive (~breakeven ≈ 25 sales/mo).

## 6. Owner checklist (the only human-gated steps)

- [ ] Create Polar org + product: "Prompt Janitor Pro — perpetual license + 12 months of
      updates", one-time $69 (founder window), no Polar benefits attached.
- [ ] Create checkout link; set `success_url` to the landing `/thanks` page.
- [ ] Replace `polar_cl_PLACEHOLDER` in `landing/src/main.js` (PR #89) and
      `src/lib/monetization.ts` (PR #90).
- [ ] Generate the production Ed25519 keypair with the vendor CLI (PR #69); embed the
      public key; store the private key in a password manager + Worker secret.
- [ ] (Automation step) deploy `pj-fulfillment` worker; register the `order.paid`
      webhook; send a $0 test order or use Polar sandbox to verify end-to-end.

## 7. Explicitly rejected

- **Polar License Keys benefit** — online-only validation breaks the offline promise
  (§1); also wrong key format.
- **Hosted license server of our own** — reintroduces COGS and an uptime obligation for
  a one-time-purchase product; the offer spec already rejected hosted anything.
- **Zapier fulfillment** — Polar's Zapier integration is trigger-only today and adds a
  subscription cost with less control than a 100-line worker; manual fallback is
  simpler at low volume, the worker is better at any volume.
- **Blocking launch on the worker** — manual fulfillment ships revenue on day 1.
