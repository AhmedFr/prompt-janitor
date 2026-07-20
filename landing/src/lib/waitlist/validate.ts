const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const KNOWN_SOURCES = new Set(["hero", "pricing-free", "pricing-pro", "footer"]);

export type ValidationResult =
  | { ok: true; email: string; source: string; bot: boolean }
  | { ok: false; error: string };

export function validateSubscribe(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) return { ok: false, error: "invalid body" };
  const { email, source, website } = body as Record<string, unknown>;
  if (typeof email !== "string") return { ok: false, error: "invalid email" };
  const cleaned = email.trim().toLowerCase();
  if (!EMAIL_RE.test(cleaned) || cleaned.length > 254) return { ok: false, error: "invalid email" };
  const src =
    typeof source === "string" && (KNOWN_SOURCES.has(source) || /^blog-[a-z0-9-]+$/.test(source))
      ? source
      : "unknown";
  const bot = typeof website === "string" && website.length > 0;
  return { ok: true, email: cleaned, source: src, bot };
}
