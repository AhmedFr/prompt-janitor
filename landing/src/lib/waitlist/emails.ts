import { FROM_EMAIL, OWNER_EMAIL, SITE_URL } from "@/lib/constants";

export interface EmailPayload {
  from: string;
  to: string[];
  subject: string;
  text: string;
}

export function buildEmails(email: string, source: string): EmailPayload[] {
  const confirmation: EmailPayload = {
    from: FROM_EMAIL,
    to: [email],
    subject: "You're on the Prompt Janitor waitlist ✅",
    text: [
      "You're in!",
      "",
      "Thanks for joining the Prompt Janitor waitlist. Here's what happens next:",
      "",
      "1. You'll get exactly one email when the app ships — the download link, nothing else.",
      "2. Founder pricing is locked in for you: Pro for $69 instead of $99. One-time, no subscription.",
      `3. Meanwhile, we publish field notes on prompt health: ${SITE_URL}/blog`,
      "",
      "No drip campaigns, no spam. Reply to this email any time — a human reads it.",
      "",
      "— Prompt Janitor",
      SITE_URL,
    ].join("\n"),
  };
  const notification: EmailPayload = {
    from: FROM_EMAIL,
    to: [OWNER_EMAIL],
    subject: `Waitlist signup: ${email} (${source})`,
    text: `New waitlist signup\n\nEmail: ${email}\nSource: ${source}\nDate: ${new Date().toISOString()}\n`,
  };
  return [confirmation, notification];
}

export async function sendEmails(payloads: EmailPayload[], apiKey: string): Promise<Response> {
  return fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payloads),
  });
}
