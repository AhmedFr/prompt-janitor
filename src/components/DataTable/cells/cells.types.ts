import type { GradeLetter } from "@/components/Grade";
import type { IconName } from "@/components/Icon";
import type { Layer } from "@/lib/ipc";

export interface GradeCellProps {
  /** Letter grade for the row's artifact; `null` renders the neutral ungraded chip. */
  grade: GradeLetter | null | undefined;
}

export interface CountCellProps {
  /** Whole count; `null` renders "—" rather than a misleading zero. */
  value: number | null | undefined;
}

export interface LastUsedCellProps {
  /**
   * `UsageStat.last_used` — a UTC RFC3339 timestamp. `null` (or no usage
   * rollup at all) means the artifact was never invoked.
   */
  lastUsed: string | null | undefined;
}

export interface PercentCellProps {
  /** Fraction in the 0–1 range (as Rust hands rates over); `null` renders "—". */
  value: number | null | undefined;
}

export interface TokensCellProps {
  /** Token count; `null` renders "—" rather than a misleading zero. */
  value: number | null | undefined;
}

export interface ScopeCellProps {
  /** Which layer the row's artifact lives in. */
  layer: Layer;
  /** Project the row belongs to, when `layer` is `"project"`. */
  projectName?: string | null;
  /**
   * Plugin that installed the row, when `layer` is `"plugin"`. Every bundled
   * row is a plugin row, so "Plugin" on its own answers a question nobody
   * asked — which plugin put it there is the provenance the column is for.
   */
  pluginName?: string | null;
}

export interface PathCellProps {
  /** Absolute path to the artifact on disk. */
  path: string;
}

/** One icon button in an {@link ActionsCellProps} row. */
export interface RowAction {
  /** Accessible name — the button has no visible text. */
  label: string;
  icon: IconName;
  onClick: () => void;
}

export interface ActionsCellProps {
  actions: RowAction[];
}
