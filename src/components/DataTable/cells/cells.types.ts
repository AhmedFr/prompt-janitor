import type { GradeLetter } from "@/components/Grade";
import type { IconName } from "@/components/Icon";
import type { Layer } from "@/lib/ipc";

export interface GradeCellProps {
  /** Letter grade for the row's artifact; `null` renders the neutral ungraded chip. */
  grade: GradeLetter | null | undefined;
}

export interface NameCellProps {
  /** The row's own name — the one thing that must stay legible when the column narrows. */
  name: string;
  /** Muted context beside it; `null`/empty renders nothing at all. */
  description?: string | null;
  /**
   * Hover text for the name. Defaults to the name itself; a table that shows
   * the description somewhere other than this cell passes the fuller string
   * here so hovering still reveals it (Setup's tables do exactly that).
   */
  title?: string;
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

/**
 * Where a rate stops being fine and starts being a problem, both as 0–1
 * fractions with `watch < bad`. Owned by the screen, not the cell: what
 * counts as a bad error rate is a product decision the table does not make.
 */
export interface RateThresholds {
  /** At or above this, the rate is worth a look (amber). */
  watch: number;
  /** At or above this, the rate is a finding (red, with an icon). */
  bad: number;
}

/** A rate's band against its {@link RateThresholds}; `unknown` when there is no value. */
export type RateTone = "good" | "watch" | "bad" | "unknown";

export interface PercentCellProps {
  /** Fraction in the 0–1 range (as Rust hands rates over); `null` renders "—". */
  value: number | null | undefined;
  /**
   * Tones the value green / amber / red against these lines. Omitted, the
   * percentage stays neutral — not every percentage is a rate with a
   * right answer.
   */
  thresholds?: RateThresholds;
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
