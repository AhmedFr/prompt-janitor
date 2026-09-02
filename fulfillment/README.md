# pj-fulfillment

Cloudflare Worker that turns a Polar `order.paid` webhook into a delivered
Prompt Janitor Pro license key. Implements the design in
[`docs/superpowers/specs/2026-07-06-polar-fulfillment-design.md`](../docs/superpowers/specs/2026-07-06-polar-fulfillment-design.md)
(relates to issue #78).

```
Polar order.paid webhook (Standard Webhooks, HMAC-signed)
  -> verify signature (401 if bad)
  -> only process type === "order.paid" (202 everything else)
  -> only process the configured Pro product (POLAR_PRO_PRODUCT_ID; 202 everything else)
  -> idempotency check on webhook-id (KV, 30 day TTL)
  -> mint PJ1.<payload>.<sig> Ed25519 license key (parity with the vendor CLI)
  -> email the key via Resend
  -> 202
```

No database, no accounts. The only state is the KV idempotency marker.

## Layout

- `src/index.ts` — the fetch handler: signature verify, event filter,
  idempotency, orchestration.
- `src/signature.ts` — Standard Webhooks verification (wraps the
  `standardwebhooks` package, which is pure JS and Workers-compatible).
- `src/mint.ts` — Ed25519 key minting, byte-for-byte compatible with the
  app's offline verifier (`src-tauri/src/license.rs`) and the vendor CLI
  (`src-tauri/src/bin/license_tool.rs`, PR #69 / branch
  `feat/67-license-vendor-tool`).
- `src/email.ts` — the license-key email template + Resend HTTP call.
- `src/types.ts` — `Env` bindings and the (loosely typed) Polar payload shape.
- `test/` — vitest; runs entirely offline, no `wrangler dev`/deploy needed.

## Key minting scheme (must match the vendor CLI exactly)

A license key is `PJ1.<base64url(payload)>.<base64url(sig)>` where:

- `payload` is the compact JSON `{"email":"…","plan":"…"}` — **in that key
  order** — signed as raw UTF-8 bytes (not a hash of them).
- `sig` is the raw 64-byte Ed25519 signature over `payload`.
- Both are base64url-encoded **without padding**.

This worker builds the same bytes a `{ email, plan }` object literal +
`JSON.stringify` produces in JS, which matches serde's declared field order
for `struct Payload { email: String, plan: String }` on the Rust side.

### Parity test vector

`test/mint.test.ts` has a fixture test asserting the worker's `mintLicenseKey`
produces an exact, byte-for-byte match for a known input. This was verified
against the *actual* vendor CLI binary while building this worker, not just
re-derived from reading its source:

```
seed (32 bytes of 0x07, same fixture src-tauri/src/license.rs's own tests use):
  base64url: BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc

license-tool mint --key <seed-file> --email dev@example.com --plan pro
  =>
PJ1.eyJlbWFpbCI6ImRldkBleGFtcGxlLmNvbSIsInBsYW4iOiJwcm8ifQ.Fi3UjQbmBKAoNsX7oP-PxXUYbJNpI6SH7hXd_Q78bsj-m0WFO3UxAgPEe9tIyXN7OdUJHFW18jk2MDHu0H3xAg
```

If you ever change the minting code, re-run the vendor CLI with this same
seed/email/plan and diff the output before trusting the new test assertion —
a matching test that's wrong in the same way as the code is not a real check.

### `LICENSE_SIGNING_KEY` format

The vendor CLI's `license-tool keygen` command writes a **bare 32-byte
Ed25519 seed, base64url-encoded, no padding** to disk (e.g.
`pj-vendor-key.secret`). That exact string is what goes into the
`LICENSE_SIGNING_KEY` Worker secret — the worker wraps it in a minimal
PKCS#8 DER envelope internally (`seedToPkcs8` in `src/mint.ts`) because
WebCrypto's `importKey` doesn't accept a bare raw seed for private keys.
Don't pre-wrap it yourself; paste the CLI's output as-is.

## Deploy

Prerequisites: a Cloudflare account, `wrangler` (installed as a
devDependency — use `pnpm exec wrangler …` or `pnpm dev` / `pnpm deploy`),
and you must be logged in (`pnpm exec wrangler login`).

1. **Install and typecheck/test locally** (from `fulfillment/`):
   ```
   pnpm install
   pnpm typecheck
   pnpm test
   ```

2. **Create the KV namespace:**
   ```
   pnpm exec wrangler kv namespace create FULFILLMENT_KV
   ```
   Copy the returned `id` into `wrangler.toml`'s `[[kv_namespaces]]` block
   (replacing `REPLACE_WITH_KV_NAMESPACE_ID`). Create a second namespace and
   a `[env.production]` / preview override if you want separate prod/staging
   KV — not done by default here since there's only one environment at
   launch.

3. **Set secrets** (each prompts for a value, nothing is written to disk):
   ```
   pnpm exec wrangler secret put POLAR_WEBHOOK_SECRET
   pnpm exec wrangler secret put LICENSE_SIGNING_KEY
   pnpm exec wrangler secret put RESEND_API_KEY
   ```
   - `POLAR_WEBHOOK_SECRET` — from the Polar webhook endpoint you're about to
     create (step 5); Polar shows it once at creation time.
   - `LICENSE_SIGNING_KEY` — the **production** vendor signing key's base64url
     seed (see "LICENSE_SIGNING_KEY format" above). Generate it with
     `license-tool keygen` if you haven't already, and make sure the printed
     public key array has been pasted into `src-tauri/src/license.rs`'s
     `PUBKEY` and shipped — a license minted with a seed that doesn't match
     the embedded `PUBKEY` will be silently rejected by the app.
   - `RESEND_API_KEY` — a Resend API key allowed to send from the
     `FROM_ADDRESS` domain configured in `src/email.ts`.

4. **Set the Pro product id** in `wrangler.toml`'s `[vars]` block:
   `POLAR_PRO_PRODUCT_ID = "<product id from the Polar dashboard>"`. This is
   the gate between "someone paid for something" and "someone bought Pro":
   every product in the org posts to the same webhook, and orders for any
   other product (a $0 test SKU, the Field Guide alone, a 100 % discount) are
   acknowledged with a 202 and never minted. Leaving it empty fails closed —
   the worker logs an error and mints nothing.

5. **Deploy:**
   ```
   pnpm deploy
   ```
   Note the worker URL Wrangler prints (`https://pj-fulfillment.<subdomain>.workers.dev`
   or your custom route/domain).

6. **Register the Polar webhook:** in the Polar dashboard, add a webhook
   endpoint pointing at the worker URL, subscribed to `order.paid` (you can
   subscribe to more events; everything except `order.paid` gets a 202 and
   is otherwise ignored). Polar shows the signing secret once here — that's
   the value for `POLAR_WEBHOOK_SECRET` in step 3.

7. **Sandbox test:** use Polar's sandbox/test mode to fire a real `order.paid`
   webhook at the deployed worker. A sandbox order for the configured Pro
   product mints; an order for any other product must produce a 202 and a
   "not for the licensed product" log line and nothing else. Confirm:
   - the worker responds 202 within Polar's ~10s timeout,
   - the buyer's inbox gets the license-key email,
   - the key pastes into the app's Settings → License and verifies (this
     requires the real production signing key to already be embedded as
     `PUBKEY` in a build, per step 3's note).
   Then check `wrangler tail` / the Cloudflare dashboard logs for errors.

8. **Failure behavior:** Polar retries a failing webhook endpoint and
   auto-disables it after repeated consecutive failures (see Polar's docs
   for the current threshold), emailing the org. The dashboard can replay
   missed deliveries once the endpoint is fixed. Nothing on our side needs
   to detect this — see "Manual fallback" below for what to do while it's
   disabled or before it's deployed at all.

## Manual fallback procedure

The worker is not the only way to fulfill an order — this is the same
process used before the worker existed (see the design spec's launch
sequencing) and the documented fallback if the worker/webhook is ever down:

1. Watch for the `order.paid` notification email from Polar (or check the
   Polar dashboard's Orders list).
2. Get the buyer's email from the order.
3. Mint a key with the vendor CLI, using the same production signing key
   file used for the worker's `LICENSE_SIGNING_KEY` secret:
   ```
   cd src-tauri
   cargo run --bin license-tool -- mint --key <path-to-prod-seed-file> --email <buyer-email> --plan pro
   ```
4. Reply to the buyer's Polar order confirmation email (or email them
   directly) with the printed key, the paste instructions (Settings →
   License, verified entirely offline, no account needed), and the 30-day
   guarantee line — see `src/email.ts`'s `renderLicenseEmailBody` for the
   canonical wording.
5. If a webhook was also received for this order (e.g. the worker is up but
   you fulfilled manually first), that's fine — the worker's idempotency
   check does *not* protect against a manual send racing a webhook, only
   against duplicate *webhook deliveries*. Duplicate delivery to the same
   buyer from both paths is a low-severity, low-likelihood annoyance, not a
   security or billing issue; there's no reconciliation step required. When
   in doubt, check `wrangler tail` or the KV namespace for the order's
   `webhook-id` before manually minting, to avoid double-sends.

## What's tested vs. what needs live verification

Covered by `pnpm test` (fully offline, no network/deploy):
signature verification (valid, wrong secret, tampered body, expired
timestamp, missing headers), event-type filtering, idempotency, the minting
parity vector, the email payload shape (mocked `fetch`), and an
integration-style pass through the whole `fetch` handler with a signed
fixture event (success, duplicate, missing email, send failure).

Needs a live pass before trusting this in production: an actual Polar
sandbox `order.paid` webhook hitting the deployed worker (step 6 above), and
minting with the real production keypair once it exists (the parity vector
above uses a well-known test seed, not the production key).
