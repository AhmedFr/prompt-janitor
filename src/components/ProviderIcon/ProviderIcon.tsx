import type { ProviderIconProps } from "./ProviderIcon.types";
import { PROVIDERS, FALLBACK_PROVIDER } from "./ProviderIcon.constants";
import "./ProviderIcon.css";

/** A colored rounded-square brand mark for a prompt file's provider. */
export function ProviderIcon({ kind, size = 26 }: ProviderIconProps) {
  const meta = PROVIDERS[kind] ?? FALLBACK_PROVIDER;
  return (
    <span
      className="provider-icon"
      style={{ width: size, height: size, background: meta.bg }}
      role="img"
      aria-label={meta.label}
    >
      <svg viewBox="0 0 24 24" width={size * 0.62} height={size * 0.62} aria-hidden="true">
        {meta.glyph}
      </svg>
    </span>
  );
}
