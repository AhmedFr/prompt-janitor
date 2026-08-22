import type { ArtifactKind, SetupView } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";

export interface SetupProps {
  navigate: Navigate;
  /** Override the live data (Storybook only); the hook supplies it in the app. */
  data?: SetupView | null;
  /** The kind tab to open on. Defaults to the remembered one, then to Rules. */
  initialTab?: ArtifactKind;
}

/** What {@link useSetup} hands the screen. */
export interface SetupState {
  data: SetupView | null;
  loading: boolean;
  refetch: () => Promise<void>;
}
