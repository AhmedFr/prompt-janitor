import { describe, expect, it } from "vitest";
import { isUnlocked, PAYMENTS_ENABLED } from "./monetization";

describe("monetization switch", () => {
  it("is off: everything is free for now (spec §13a)", () => {
    expect(PAYMENTS_ENABLED).toBe(false);
  });

  it("unlocks every gate while payments are off, whatever the entitlement says", () => {
    expect(isUnlocked(false)).toBe(true);
    expect(isUnlocked(undefined)).toBe(true);
    expect(isUnlocked(true)).toBe(true);
  });
});
