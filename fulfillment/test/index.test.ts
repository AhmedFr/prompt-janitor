import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "../src/index";
import type { Env } from "../src/types";
import { publicKeyFromSeed, verifyLicenseKey } from "./fixtures";
import { MemoryKV, TEST_SIGNING_SEED, TEST_SIGNING_SEED_B64URL, TEST_WEBHOOK_SECRET, orderPaidEvent, signWebhookBody } from "./fixtures";

function makeEnv(kv = new MemoryKV()): Env {
  return {
    FULFILLMENT_KV: kv as unknown as Env["FULFILLMENT_KV"],
    POLAR_WEBHOOK_SECRET: TEST_WEBHOOK_SECRET,
    LICENSE_SIGNING_KEY: TEST_SIGNING_SEED_B64URL,
    RESEND_API_KEY: "re_test_key",
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
});
