import type { ArtifactKind, ArtifactView, EffectiveRule, SetupView } from "@/lib/ipc";
import type { Navigate } from "@/App/App.types";
import type { SetupFilter } from "./setup.util";

export interface SetupProps {
  navigate: Navigate;
  /** Override the live data (Storybook only); the hook supplies it in the app. */
  data?: SetupView | null;
  /** Filter the screen opens on. Defaults to `all`; Storybook uses it to pin a state. */
  initialFilter?: SetupFilter;
}

/** One filter chip in the toolbar. */
export interface FilterChip {
  id: SetupFilter;
  label: string;
}

/** Artifacts of one kind, ready to render as a titled section. */
export interface KindGroup {
  kind: ArtifactKind;
  items: ArtifactView[];
}

/** What {@link useSetup} hands the screen. */
export interface SetupState {
  data: SetupView | null;
  loading: boolean;
  filter: SetupFilter;
  setFilter: (filter: SetupFilter) => void;
  refetch: () => Promise<void>;
  /** Lazily loads (and memoises) the rule stack that applies to one project. */
  effectiveRulesFor: (harness: string, projectPath: string) => Promise<EffectiveRule[]>;
}
