import { describe, expect, it } from "vitest";
import { verifyWebhookSignature, SignatureVerificationError } from "../src/signature";
import { TEST_WEBHOOK_SECRET, signWebhookBody } from "./fixtures";

describe("verifyWebhookSignature", () => {
  it("accepts a validly signed payload and returns the parsed body", () => {
    const body = { type: "order.paid", data: { id: "order_1" } };
    const { payload, headers } = signWebhookBody(TEST_WEBHOOK_SECRET, body);

    const parsed = verifyWebhookSignature(TEST_WEBHOOK_SECRET, payload, headers);

    expect(parsed).toEqual(body);
  });

  it("rejects a payload signed with the wrong secret", () => {
    const body = { type: "order.paid", data: { id: "order_1" } };
    const { payload, headers } = signWebhookBody("whsec_" + "a".repeat(40), body);

    expect(() => verifyWebhookSignature(TEST_WEBHOOK_SECRET, payload, headers)).toThrow(
      SignatureVerificationError
    );
  });

  it("rejects a tampered body (signature no longer matches)", () => {
    const body = { type: "order.paid", data: { id: "order_1" } };
    const { payload, headers } = signWebhookBody(TEST_WEBHOOK_SECRET, body);
    const tampered = payload.replace("order_1", "order_evil");

    expect(() => verifyWebhookSignature(TEST_WEBHOOK_SECRET, tampered, headers)).toThrow(
      SignatureVerificationError
    );
  });

  it("rejects an expired (too old) timestamp", () => {
    const body = { type: "order.paid", data: { id: "order_1" } };
    const staleTimestamp = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const { payload, headers } = signWebhookBody(TEST_WEBHOOK_SECRET, body, {
      timestamp: staleTimestamp,
    });

    expect(() => verifyWebhookSignature(TEST_WEBHOOK_SECRET, payload, headers)).toThrow(
      SignatureVerificationError
    );
  });

  it("rejects missing signature headers", () => {
    const body = { type: "order.paid", data: { id: "order_1" } };
    const payload = JSON.stringify(body);

    expect(() =>
      verifyWebhookSignature(TEST_WEBHOOK_SECRET, payload, {
        "webhook-id": "",
        "webhook-timestamp": "",
        "webhook-signature": "",
      })
    ).toThrow(SignatureVerificationError);
  });
});
