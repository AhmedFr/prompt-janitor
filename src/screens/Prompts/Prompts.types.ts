import type { FileRow } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";

export interface PromptsProps {
  navigate: Navigate;
  /**
   * A project id (its absolute root path) the caller wants this table opened
   * on — the Project pill is preselected to it, over whatever the table last
   * remembered.
   */
  target?: string;
  /** Override the live data (Storybook only); the hook supplies it in the app. */
  data?: FileRow[] | null;
}

/** What {@link usePromptsList} hands the screen. */
export interface PromptsState {
  data: FileRow[] | null;
  loading: boolean;
  refetch: () => Promise<void>;
}
