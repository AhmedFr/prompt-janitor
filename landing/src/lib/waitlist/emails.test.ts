import { describe, expect, it } from "vitest";
import { buildEmails } from "./emails";
import { FROM_EMAIL, OWNER_EMAIL } from "@/lib/constants";

describe("buildEmails", () => {
  it("builds exactly a confirmation and an owner notification", () => {
    const [confirm, notify] = buildEmails("dev@example.com", "pricing-pro");
    expect(confirm.to).toEqual(["dev@example.com"]);
    expect(confirm.from).toBe(FROM_EMAIL);
    expect(confirm.subject).toContain("waitlist");
    expect(confirm.text).toContain("$19");
    expect(confirm.text).toContain("https://promptjanitor.app");

    expect(notify.to).toEqual([OWNER_EMAIL]);
    expect(notify.subject).toBe("Waitlist signup: dev@example.com (pricing-pro)");
    expect(notify.text).toContain("dev@example.com");
    expect(notify.text).toContain("pricing-pro");
  });
});
