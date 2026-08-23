import type { GradeLetter } from "@/components/Grade";
import type { IconName } from "@/components/Icon";
import type { Layer, UsageStat } from "@/lib/ipc";

export interface GradeCellProps {
  /** Letter grade for the row's artifact; `null` renders the neutral ungraded chip. */
  grade: GradeLetter | null | undefined;
}

export interface UsageCellProps {
  /** Usage rollup for the row; `null` means the artifact was never invoked. */
  usage: UsageStat | null;
  /** Reference instant for relative-time formatting. Defaults to `new Date()`. */
  now?: Date;
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
  /**
   * The action exists for this column but has nothing to act on in this row
   * — a rule with no pattern has nothing to copy. Shown greyed rather than
   * dropped, so the column keeps one button per row and the reader learns
   * the action is unavailable here, not absent everywhere.
   */
  disabled?: boolean;
}

export interface ActionsCellProps {
  actions: RowAction[];
}
