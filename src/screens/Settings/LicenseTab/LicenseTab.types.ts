import type { Entitlement } from "@/lib/ipc";

export interface LicenseTabProps {
  /** The current entitlement, or null while loading. */
  entitlement: Entitlement | null;
  /** Validate + store a license key; resolves to a status message. */
  onActivate: (key: string) => Promise<string>;
  /** Remove the stored license, returning to the free tier. */
  onRemove: () => Promise<void>;
}
