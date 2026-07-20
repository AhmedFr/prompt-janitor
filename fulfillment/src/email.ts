/** Sender identity. Change here (not inline at call sites) if it ever moves domains. */
export const FROM_ADDRESS = "Prompt Janitor <license@promptjanitor.app>";

export const SUBJECT = "Your Prompt Janitor Pro license key";

/** Plain-text body: the key, paste instructions, and the guarantee line. */
export function renderLicenseEmailBody(licenseKey: string): string {
  return `Thanks for buying Prompt Janitor Pro!

Your license key:

${licenseKey}

How to use it:
1. Open Prompt Janitor
2. Go to Settings -> License
3. Paste the key above and save

The key is verified entirely offline — no account, no phoning home. It never
expires and there's nothing else to install.

Guarantee: if Prompt Janitor doesn't earn its keep, email us within 30 days
of purchase for a full refund, no questions asked about your letter grades.

Questions? Just reply to this email.
`;
}

export interface ResendEmailPayload {
  from: string;
  to: string[];
  subject: string;
  text: string;
}

export function renderLicenseEmail(to: string, licenseKey: string): ResendEmailPayload {
  return {
    from: FROM_ADDRESS,
    to: [to],
    subject: SUBJECT,
    text: renderLicenseEmailBody(licenseKey),
  };
}

/** Send the license-key email via the Resend HTTP API. */
export async function sendLicenseEmail(
  apiKey: string,
  to: string,
  licenseKey: string,
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  return fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(renderLicenseEmail(to, licenseKey)),
  });
}
