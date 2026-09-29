/** A project the lens can be turned on for. */
export interface ViewingSwitcherProject {
  path: string;
  name: string;
  /** ISO timestamp of the project's latest session; `null` when it has none. */
  lastSessionAt: string | null;
}

export interface ViewingSwitcherProps {
  projects: ViewingSwitcherProject[];
  /** Path of the project the lens is on, or `null` for the whole setup. */
  lens: string | null;
  onChange: (lens: string | null) => void;
}
