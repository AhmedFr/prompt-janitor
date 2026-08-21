// Monetisation paused (2026-08): constants kept for when gates return.
// Single home for the purchase link + price copy, so every Pro CTA in the app
// stays consistent and there is exactly one place to update.

export const POLAR_CHECKOUT_URL = "https://buy.polar.sh/polar_cl_PLACEHOLDER"; // TODO(#78): replace with the real Polar checkout link

/** Price line shown next to purchase CTAs. */
export const FOUNDER_PRICE = "$69 founder pricing";

/** Primary purchase CTA (Settings → License). Intentionally unused while
 * gates are open — nothing renders a purchase CTA right now — kept ready
 * for when monetisation resumes. */
export const GET_LICENSE_LABEL = `Get a license — ${FOUNDER_PRICE}`;

/** Compact purchase CTA used inline (Detail issue panel, locked actions). */
export const GET_PRO_LABEL = "Get Pro";

/** Reminder shown next to locked actions for users who already bought. The
 * location is separate so callers can render it as a link into Settings. */
export const PASTE_KEY_HINT_PREFIX = "or paste your key in";
export const PASTE_KEY_HINT_LOCATION = "Settings → License";
