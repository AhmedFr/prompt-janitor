export interface ScanningTabProps {
  /** The persisted scan-frequency key, or null while loading. */
  schedule: string | null;
  /** Called with the newly picked frequency key. */
  onChange: (key: string) => void;
}
