import type { Navigate } from "@/App/App.types";
import type { TemplateInfo } from "@/lib/ipc";

/** Outcome of a one-click template apply, as returned by `useTemplatePicker`. */
export type ApplyOutcome =
  | { status: "cancelled" }
  | { status: "error"; message: string }
  | { status: "done"; path: string; fileId: string | null };

export interface TemplatePickerProps {
  templates: TemplateInfo[];
  /** Paid tier unlocked — gates the one-click apply, not browsing/reading. */
  entitled: boolean;
  loading: boolean;
  /** Pick a destination folder, write the template there, and rescan. */
  onApply: (templateId: string) => Promise<ApplyOutcome>;
  /** Close the picker without applying anything. */
  onClose: () => void;
  navigate: Navigate;
}
