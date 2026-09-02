import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/types";
import { publicKeyFromSeed, verifyLicenseKey } from "./fixtures";
import {
  MemoryKV,
  TEST_PRO_PRODUCT_ID,
  TEST_SIGNING_SEED,
  TEST_SIGNING_SEED_B64URL,
  TEST_WEBHOOK_SECRET,
  orderPaidEvent,
  signWebhookBody,
} from "./fixtures";

function makeEnv(kv = new MemoryKV()): Env {
  return {
    FULFILLMENT_KV: kv as unknown as Env["FULFILLMENT_KV"],
    POLAR_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET,
    LICENSE_SIGNING_KEY: TEST_SIGNING_SEED_B64URL,
    RESEND_API_KEY: "re_test_key",
    POLAR_PRO_PRODUCT_ID: TEST_PRO_PRODUCT_ID,
  };
}

function signedRequest(body: unknown, opts?: { id?: string; timestamp?: Date }): Request {
  const { payload, headers } = signWebhookBody(TEST_WEBHOOK_SECRET, body, opts);
  return new Request("https://worker.example/", {
    method: "POST",
    body: payload,
    headers,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("worker fetch handler", () => {
  it("rejects non-POST requests", async () => {
    const response = await worker.fetch(new Request("https://worker.example/", { method: "GET" }), makeEnv());
    expect(response.status).toBe(405);
  });

  it("rejects a request with an invalid signature", async () => {
    const request = signedRequest(orderPaidEvent());
    // Corrupt the signature header after signing.
    const tampered = new Request(request, {
      headers: { ...Object.fromEntries(request.headers), "webhook-signature": "v1,not-a-real-signature" },
    });

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(tampered, makeEnv());

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("202s and ignores non-order.paid events without minting or emailing", async () => {
    const request = signedRequest(orderPaidEvent({ type: "order.refunded" }));
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await worker.fetch(request, makeEnv());

    expect(response.status).toBe(202);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("mints a key and emails it for a valid order.paid event", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const kv = new MemoryKV();

    const request = signedRequest(orderPaidEvent({ email: "buyer@example.com", orderId: "order_42" }), {
      id: "msg_order_42",
    });
    const response = await worker.fetch(request, makeEnv(kv));

    expect(response.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    const sentBody = JSON.parse(init?.body as string);
    expect(sentBody.to).toEqual(["buyer@example.com"]);

    // The emailed key actually verifies against the configured signing key.
    const licenseMatch = sentBody.text.match(/PJ1\.[\w-]+\.[\w-]+/);
    expect(licenseMatch).not.toBeNull();
    const pub = await publicKeyFromSeed(TEST_SIGNING_SEED);
    const info = await verifyLicenseKey(licenseMatch![0], pub);
    expect(info).toEqual({ email: "buyer@example.com", plan: "pro" });

    // Idempotency was recorded.
    expect(kv.has("webhook:msg_order_42")).toBe(true);
  });

  /**
   * Every product in the Polar org posts to the same webhook. Only the one
   * configured as Pro may mint a key — a $0 test SKU, the Field Guide sold
   * alone, or a future free tier must never produce a perpetual Pro license.
   */
  it("202s without minting or emailing when the order is for a different product", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const kv = new MemoryKV();

    const request = signedRequest(orderPaidEvent({ productId: "prod_field_guide" }), { id: "msg_other_product" });
    const response = await worker.fetch(request, makeEnv(kv));

    expect(response.status).toBe(202);
    expect(await response.text()).toMatch(/not for the licensed product/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(kv.has("webhook:msg_other_product")).toBe(false);
    // The log line is the only trace of a wrong-product order; it must name
    // the delivery and the product so the owner can find it in the dashboard.
    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ webhookId: "msg_other_product", productId: "prod_field_guide" }),
    );
    errorSpy.mockRestore();
  });

  it("202s without minting when the order carries no product_id at all", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const kv = new MemoryKV();

    const request = signedRequest(orderPaidEvent({ productId: null }), { id: "msg_no_product" });
    const response = await worker.fetch(request, makeEnv(kv));

    expect(response.status).toBe(202);
    expect(await response.text()).toMatch(/not for the licensed product/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(kv.has("webhook:msg_no_product")).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ webhookId: "msg_no_product", productId: null }),
    );
    errorSpy.mockRestore();
  });

  /**
   * A deploy with the placeholder still in wrangler.toml must not mint — and
   * must not answer 2xx either, or Polar would consider every real purchase
   * delivered and never retry. 5xx makes Polar retry and then disable the
   * endpoint loudly, and the orders stay replayable once the var is set.
   */
  it.each([
    ["unset", undefined],
    ["empty", ""],
    ["blank", "   "],
  ])("fails closed with a 5xx and mints nothing when POLAR_PRO_PRODUCT_ID is %s", async (_label, value) => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const kv = new MemoryKV();
    const env: Env = { ...makeEnv(kv), POLAR_PRO_PRODUCT_ID: value };

    const request = signedRequest(orderPaidEvent(), { id: "msg_unconfigured" });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(500);
    expect(await response.text()).toMatch(/not configured/);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(kv.has("webhook:msg_unconfigured")).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringMatching(/not configured/),
      expect.objectContaining({ webhookId: "msg_unconfigured" }),
    );
    errorSpy.mockRestore();
  });

  it("does not re-process (or re-email) an already-seen webhook-id", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const kv = new MemoryKV();
    const env = makeEnv(kv);

    const first = signedRequest(orderPaidEvent({ email: "buyer@example.com" }), { id: "msg_dup" });
    const firstResponse = await worker.fetch(first, env);
    expect(firstResponse.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = signedRequest(orderPaidEvent({ email: "buyer@example.com" }), { id: "msg_dup" });
    const secondResponse = await worker.fetch(second, env);
    expect(secondResponse.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(1); // still 1 — not re-sent
  });

  it("202s without minting when no buyer email can be extracted (manual fallback lane)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = signedRequest(orderPaidEvent({ email: null }));
    const response = await worker.fetch(request, makeEnv());

    expect(response.status).toBe(202);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("returns 502 (so Polar retries) and does not record idempotency when email delivery fails", async () => {
    const fetchMock = vi.fn(async () => new Response("server error", { status: 500 }));
    vi.stubGlobal("fetch", fetchMock);
    const kv = new MemoryKV();

    const request = signedRequest(orderPaidEvent({ email: "buyer@example.com" }), { id: "msg_fail" });
    const response = await worker.fetch(request, makeEnv(kv));

    expect(response.status).toBe(502);
    expect(kv.has("webhook:msg_fail")).toBe(false);
  });

  it("a retry after a failed send succeeds and actually sends the email", async () => {
    const kv = new MemoryKV();
    const env = makeEnv(kv);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("server error", { status: 500 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const first = signedRequest(orderPaidEvent({ email: "buyer@example.com" }), { id: "msg_retry" });
    const firstResponse = await worker.fetch(first, env);
    expect(firstResponse.status).toBe(502);
    expect(kv.has("webhook:msg_retry")).toBe(false); // marker released, retry not suppressed

    const second = signedRequest(orderPaidEvent({ email: "buyer@example.com" }), { id: "msg_retry" });
    const secondResponse = await worker.fetch(second, env);

    expect(secondResponse.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(kv.has("webhook:msg_retry")).toBe(true);
    expect(JSON.parse(kv.raw.get("webhook:msg_retry")!).status).toBe("sent");
  });

  it("collapses a concurrent duplicate delivery to a single email (optimistic-lock idempotency)", async () => {
    let resolveEmail!: (response: Response) => void;
    const emailGate = new Promise<Response>((resolve) => {
      resolveEmail = resolve;
    });
    const fetchMock = vi.fn(() => emailGate);
    vi.stubGlobal("fetch", fetchMock);
    const kv = new MemoryKV();
    const env = makeEnv(kv);

    const first = signedRequest(orderPaidEvent({ email: "buyer@example.com" }), { id: "msg_concurrent" });
    const firstPromise = worker.fetch(first, env);

    // Let the first delivery run far enough to write the "processing"
    // marker and call out to Resend (which is now blocked on `emailGate`)
    // before the "concurrent" second delivery starts — this exercises the
    // window the optimistic lock is meant to close: the marker is already
    // there well before the first delivery's email actually completes.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(kv.has("webhook:msg_concurrent")).toBe(true);

    const second = signedRequest(orderPaidEvent({ email: "buyer@example.com" }), { id: "msg_concurrent" });
    const secondResponse = await worker.fetch(second, env);

    // The duplicate delivery sees the "processing" marker and bails
    // immediately, without ever calling Resend again.
    expect(secondResponse.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveEmail(new Response("{}", { status: 200 }));
    const firstResponse = await firstPromise;

    expect(firstResponse.status).toBe(202);
    expect(fetchMock).toHaveBeenCalledTimes(1); // still just one email, ever
    expect(JSON.parse(kv.raw.get("webhook:msg_concurrent")!).status).toBe("sent");
  });

  it("returns 500 with a non-secret diagnostic log when the signing key is malformed", async () => {
    const kv = new MemoryKV();
    const env: Env = { ...makeEnv(kv), LICENSE_SIGNING_KEY: "not-a-valid-seed" };
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const request = signedRequest(orderPaidEvent({ email: "buyer@example.com" }), { id: "msg_badkey" });
    const response = await worker.fetch(request, env);

    expect(response.status).toBe(500);
    expect(fetchMock).not.toHaveBeenCalled(); // never got as far as emailing

    // A diagnostic line was logged, but it never contains the secret value.
    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedText = consoleErrorSpy.mock.calls
      .flat()
      .map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg)))
      .join(" ");
    expect(loggedText).toContain("license signing key misconfigured");
    expect(loggedText).not.toContain(env.LICENSE_SIGNING_KEY);

    // Marker released so a retry (after the secret is fixed) isn't suppressed.
    expect(kv.has("webhook:msg_badkey")).toBe(false);

    consoleErrorSpy.mockRestore();
  });
});
