import { NextResponse } from "next/server";
import { validateSubscribe } from "@/lib/waitlist/validate";
import { buildEmails, sendEmails } from "@/lib/waitlist/emails";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const result = validateSubscribe(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  if (result.bot) return NextResponse.json({ ok: true }); // honeypot: pretend success, send nothing

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set");
    return NextResponse.json({ error: "email delivery unavailable" }, { status: 503 });
  }

  const res = await sendEmails(buildEmails(result.email, result.source), apiKey);
  if (!res.ok) {
    console.error("resend error", res.status, await res.text());
    return NextResponse.json({ error: "email delivery failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
