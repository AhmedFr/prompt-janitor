import type { Route } from "@/App/App.types";

/** The three counts a snapshot carries, named rather than positional. */
export interface SignalCounts {
  /** Skills the user wrote that nothing has ever invoked. */
  neverUsedSkills: number;
  /** MCP servers erroring above the shared threshold. */
  mcpErroring: number;
  /** Sessions started today, across every harness. */
  sessionsToday: number;
}

export interface PanelSignalsProps extends SignalCounts {
  /** Raise the main window on the screen where this signal is dealt with. */
  onOpen: (route: Route, target: string | null) => void;
}

/** One chip: which count it shows, where it is fixed, and how it is painted. */
export interface SignalSpec {
  id: string;
  /** Picks this chip's number out of the snapshot's counts. */
  count: (counts: SignalCounts) => number;
  /** The visible text for that count, e.g. "3 never-used skills". */
  text: (count: number) => string;
  /** Where the chip goes, and what it opens there. */
  route: Route;
  target: string | null;
  /** Named in the accessible label so the chip says where it leads. */
  destination: string;
  /**
   * Whether a non-zero count is a problem. "12 sessions today" is neither
   * good nor bad — painting it red would invent a verdict.
   */
  toned: boolean;
}
