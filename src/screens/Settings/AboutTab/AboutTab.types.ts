import type { AppStatus } from "@/lib/ipc";

export interface AboutTabProps {
  /** The persisted app status, or null while loading. */
  status: AppStatus | null;
}
