import { describe, expect, it, vi } from "vitest";
import { sendLicenseEmail, FROM_ADDRESS, SUBJECT } from "../src/email";

describe("sendLicenseEmail", () => {
  it("posts the expected payload shape to Resend", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("{}", { status: 200 }));

    await sendLicenseEmail("re_test_key", "buyer@example.com", "PJ1.abc.def", fetchMock);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.resend.com/emails");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer re_test_key",
      "Content-Type": "application/json",
    });

    const body = JSON.parse(init?.body as string);
    expect(body.from).toBe(FROM_ADDRESS);
    expect(body.to).toEqual(["buyer@example.com"]);
    expect(body.subject).toBe(SUBJECT);
    expect(body.text).toContain("PJ1.abc.def");
    expect(body.text).toContain("Settings");
    expect(body.text).toContain("License");
    expect(body.text.toLowerCase()).toContain("offline");
    expect(body.text).toContain("30 days");
  });

  it("propagates the Response from a failed send so callers can react", async () => {
    const fetchMock = vi.fn(async () => new Response("bad request", { status: 422 }));

    const response = await sendLicenseEmail("re_test_key", "buyer@example.com", "PJ1.abc.def", fetchMock);

    expect(response.ok).toBe(false);
    expect(response.status).toBe(422);
  });
});
