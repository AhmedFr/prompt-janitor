import type { ColumnDef } from "@tanstack/react-table";
import { ActionsCell, type PillGroup, type RowAction } from "@/components/DataTable";
import { SeverityDot } from "@/components/SeverityDot";
import { SOURCES, SourceBadge } from "@/components/SourceBadge";
import type { RuleInfo, Severity, Source } from "@/lib/ipc";
import type { TabItem } from "@/components/Tabs";
import { RULE_TABS } from "./Rules.constants";
import type { RuleTabId } from "./Rules.types";

/** What the rule columns close over — the three things a row can do. */
export interface RuleColumnsCtx {
  /** Enable or disable the rule, from its switch. */
  toggle: (id: string, enabled: boolean) => void;
  /**
   * Remove a custom rule. Offered on whichever tab the row lands on, not just
   * Custom — a natural-language standard the user wrote sits under AI
   * standards and is still theirs to delete.
   */
  onDelete: (id: string) => void;
  /** Put a rule's pattern (or NL instruction) on the clipboard. */
  onCopy: (pattern: string) => void;
}

/** Severity as the dots read it, worst first. */
const SEVERITY_LABELS: Record<Severity, string> = { hi: "Critical", mid: "Warning", lo: "Nit" };

const SEVERITY_ORDER: Severity[] = ["hi", "mid", "lo"];

/** Sortable weight for a severity — higher is worse, so "descending" reads as "worst first". */
export function severityRank(severity: Severity): number {
  return SEVERITY_ORDER.length - SEVERITY_ORDER.indexOf(severity);
}

/**
 * Which tab a rule belongs to. `nl` is checked first: a natural-language rule
 * is an AI standard whether the user wrote it or it shipped, and putting a
 * custom NL rule on the Custom tab would split the AI standards in two.
 */
export function tabOf(rule: RuleInfo): RuleTabId {
  if (rule.nl) return "ai";
  return rule.custom ? "custom" : "builtin";
}

/**
 * Every tab's rows, in source order, with an entry for every tab — a tab with
 * nothing in it still renders, and its table says so itself rather than the
 * strip hiding it.
 */
export function rowsByTab(rules: RuleInfo[]): Map<RuleTabId, RuleInfo[]> {
  const byTab = new Map<RuleTabId, RuleInfo[]>(RULE_TABS.map((tab) => [tab.id, []]));
  for (const rule of rules) byTab.get(tabOf(rule))?.push(rule);
  return byTab;
}

/**
 * The tab strip, badged "enabled/total". Both halves matter: a tab holding 40
 * rules of which 3 are on is a very different setup from one holding 3, and a
 * single number would have to pick which of the two to tell you.
 */
export function tabItems(byTab: Map<RuleTabId, RuleInfo[]>): TabItem[] {
  return RULE_TABS.map((tab) => {
    const rows = byTab.get(tab.id) ?? [];
    const on = rows.filter((rule) => rule.enabled).length;
    return { id: tab.id, label: tab.label, countLabel: `${on}/${rows.length}` };
  });
}

function enabledColumn(ctx: RuleColumnsCtx): ColumnDef<RuleInfo, unknown> {
  return {
    id: "enabled",
    header: "Enabled",
    accessorFn: (r) => (r.enabled ? 1 : 0),
    cell: (c) => {
      const rule = c.row.original;
      return (
        <input
          type="checkbox"
          role="switch"
          className="rules-switch"
          checked={rule.enabled}
          // Every switch in a column of switches needs its own name; "Enabled"
          // repeated down the table tells assistive tech nothing.
          aria-label={`Enable ${rule.title}`}
          // Belt and braces: `DataTable` already treats a click on a control
          // inside a row as the control's, but a switch must never also be
          // read as "open this row" if the table ever gains a row click.
          onClick={(event) => event.stopPropagation()}
          onChange={() => ctx.toggle(rule.id, !rule.enabled)}
        />
      );
    },
  };
}

/**
 * Title with its description muted beside it — the description is what makes
 * a terse rule name mean something, and it is one of the three things the
 * search box looks at.
 */
function titleColumn(): ColumnDef<RuleInfo, unknown> {
  return {
    id: "title",
    header: "Title",
    accessorKey: "title",
    cell: (c) => (
      <span>
        {c.row.original.title}
        {c.row.original.description && <span className="muted"> · {c.row.original.description}</span>}
      </span>
    ),
  };
}

function sourceColumn(): ColumnDef<RuleInfo, unknown> {
  return {
    id: "source",
    header: "Source",
    // Sorts by the badge's own wording, so a header click orders the rows the
    // way the column reads rather than by the raw enum value.
    accessorFn: (r) => SOURCES[r.source].label,
    cell: (c) => <SourceBadge source={c.row.original.source} />,
  };
}

function severityColumn(): ColumnDef<RuleInfo, unknown> {
  return {
    id: "severity",
    header: "Severity",
    accessorFn: (r) => severityRank(r.severity),
    cell: (c) => (
      <span className="rules-severity">
        <SeverityDot level={c.row.original.severity} />
        {SEVERITY_LABELS[c.row.original.severity]}
      </span>
    ),
  };
}

function hitsColumn(): ColumnDef<RuleInfo, unknown> {
  return {
    id: "hits",
    header: "Hits",
    accessorKey: "hit_count",
    meta: { align: "right" },
    cell: (c) => <span className="dt-num">{c.row.original.hit_count}</span>,
  };
}

/**
 * Built from the *row*, never from the tab it happens to be sitting on. The
 * two are not the same question: a natural-language standard the user wrote
 * (`custom && nl`) lands on the AI tab and is still theirs to delete, and a
 * tab-driven column would have silently taken that away.
 *
 * What a row can offer is exactly what it carries. `list_rules`
 * (`query.rs`) gives built-in *pattern* rules `pattern: null` — they are Rust
 * code, not text — so those rows have nothing to copy and nothing to remove,
 * and get no button at all. A greyed-out button on every built-in row would
 * be a column of furniture claiming an action that does not exist for them.
 */
function actionsColumn(ctx: RuleColumnsCtx): ColumnDef<RuleInfo, unknown> {
  return {
    id: "actions",
    header: "Actions",
    enableSorting: false,
    meta: { align: "right" },
    cell: (c) => {
      const rule = c.row.original;
      const actions: RowAction[] = [];
      // Bound outside the closure so the null check narrows it.
      const pattern = rule.pattern;
      if (pattern !== null) {
        actions.push({
          // Every button in a column of identical icons needs its own name.
          label: `Copy pattern for ${rule.title}`,
          icon: "layers",
          onClick: () => ctx.onCopy(pattern),
        });
      }
      if (rule.custom) {
        actions.push({ label: `Delete ${rule.title}`, icon: "x", onClick: () => ctx.onDelete(rule.id) });
      }
      return actions.length > 0 ? <ActionsCell actions={actions} /> : null;
    },
  };
}

function buildColumns(ctx: RuleColumnsCtx): ColumnDef<RuleInfo, unknown>[] {
  return [enabledColumn(ctx), titleColumn(), sourceColumn(), severityColumn(), hitsColumn(), actionsColumn(ctx)];
}

/**
 * Identity-stable across calls with the *same* `ctx` object — cached in a
 * `WeakMap`, exactly as `columnsFor` does on the Setup screen and for the same
 * reason: `DataTable` memoises its column model, filtered set and chip counts
 * on this array's identity (see `DataTableProps`), so a screen re-rendering on
 * every keystroke must not hand it a fresh array each time. The screen has to
 * memoise `ctx` for the cache to ever hit, and must replace it rather than
 * mutate it — a mutated `ctx` would leave every cached column reading stale
 * closures.
 *
 * One set of defs for all three tabs, because a row's actions come from the
 * row: nothing here varies by tab any more.
 *
 * `RuleInfo` carries no dimension, so there is no Dimension column here
 * despite spec §4.3 listing one; inventing a value would be worse than the
 * gap.
 */
const columnsCache = new WeakMap<RuleColumnsCtx, ColumnDef<RuleInfo, unknown>[]>();

export function columnsFor(ctx: RuleColumnsCtx): ColumnDef<RuleInfo, unknown>[] {
  let defs = columnsCache.get(ctx);
  if (!defs) {
    defs = buildColumns(ctx);
    columnsCache.set(ctx, defs);
  }
  return defs;
}

/**
 * Worst first. A rules table answers "what am I actually enforcing, and how
 * hard" — and unlike hits (zero for most of a freshly installed pack) or
 * title (alphabetical, which says nothing), severity orders the rows by how
 * much each one matters.
 */
export const DEFAULT_SORT = { id: "severity", desc: true } as const;

/**
 * Source, severity, on/off and whether the rule is catching anything. Source
 * is derived — a group whose single chip matches every row is furniture, so
 * it only appears once a tab actually holds more than one source (the Custom
 * tab never does). The rest are fixed: a chip that matches nothing still
 * tells the reader that slice exists, and `DataTable` facets the counts.
 */
export function buildPills(rows: RuleInfo[]): PillGroup<RuleInfo>[] {
  const groups: PillGroup<RuleInfo>[] = [];

  const sources = [...new Set(rows.map((r) => r.source))].sort((a, b) =>
    SOURCES[a].label.localeCompare(SOURCES[b].label),
  );
  if (sources.length > 1) {
    groups.push({
      id: "source",
      label: "Source",
      multi: true,
      options: sources.map((source: Source) => ({
        id: source,
        label: SOURCES[source].label,
        predicate: (r: RuleInfo) => r.source === source,
      })),
    });
  }

  groups.push({
    id: "severity",
    label: "Severity",
    multi: true,
    options: SEVERITY_ORDER.map((severity) => ({
      id: severity,
      label: SEVERITY_LABELS[severity],
      predicate: (r: RuleInfo) => r.severity === severity,
    })),
  });

  groups.push({
    // Not `multi`: "on" and "off" together is every rule, which is the
    // unfiltered table the user already has.
    id: "enabled",
    label: "Enabled",
    options: [
      { id: "on", label: "On", predicate: (r: RuleInfo) => r.enabled },
      { id: "off", label: "Off", predicate: (r: RuleInfo) => !r.enabled },
    ],
  });

  groups.push({
    id: "hits",
    label: "Hits",
    options: [{ id: "has", label: "Has hits", predicate: (r: RuleInfo) => r.hit_count > 0 }],
  });

  return groups;
}
