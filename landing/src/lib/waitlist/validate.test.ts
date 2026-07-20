import { describe, expect, it } from "vitest";
import { validateSubscribe } from "./validate";

describe("validateSubscribe", () => {
  it("accepts a valid email and known source", () => {
    const r = validateSubscribe({ email: "Dev@Example.com ", source: "hero", website: "" });
    expect(r).toEqual({ ok: true, email: "dev@example.com", source: "hero", bot: false });
  });

  it("accepts blog-<slug> sources", () => {
    const r = validateSubscribe({ email: "a@b.co", source: "blog-diagnosis-should-be-free" });
    expect(r).toMatchObject({ ok: true, source: "blog-diagnosis-should-be-free" });
  });

  it("normalizes unknown sources to 'unknown'", () => {
    const r = validateSubscribe({ email: "a@b.co", source: "evil<script>" });
    expect(r).toMatchObject({ ok: true, source: "unknown" });
  });

  it("rejects malformed emails", () => {
    expect(validateSubscribe({ email: "nope", source: "hero" })).toEqual({ ok: false, error: "invalid email" });
    expect(validateSubscribe({ email: "a@b", source: "hero" })).toEqual({ ok: false, error: "invalid email" });
  });

  it("rejects non-object bodies", () => {
    expect(validateSubscribe(null)).toEqual({ ok: false, error: "invalid body" });
    expect(validateSubscribe("hi")).toEqual({ ok: false, error: "invalid body" });
  });

  it("flags the honeypot as bot", () => {
    const r = validateSubscribe({ email: "a@b.co", source: "hero", website: "http://spam" });
    expect(r).toMatchObject({ ok: true, bot: true });
  });
});
