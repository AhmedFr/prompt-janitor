import type { ColumnDef } from "@tanstack/react-table";
import type { ArtifactKind } from "@/lib/ipc";
import { EMPTY_MARK, FindingsCell, ScopeCell, TokensCell } from "@/components/DataTable";
import { KIND_SINGULAR, type KindFilter } from "@/lib/vocabulary";
import {
  COLUMN_WIDTH,
  errorRateColumn,
  lastUsedColumn,
  nameColumn,
  scopeLabel,
  usesColumn,
  type ColumnsCtx,
} from "./setup.columns";
import { projectNameFor } from "./setup.util";
import type { SetupRow } from "./setupRows.util";

/** Kinds the usage index counts (skills, agents, commands, MCP servers) — hooks are not among them. */
export const USAGE_KINDS: ReadonlySet<ArtifactKind> = new Set(["skill", "agent", "command", "mcp_server"]);

/** A rough, labelled (≈) estimate: an instruction file is paid for by its size, every session. */
export const BYTES_PER_TOKEN = 4;

const ORDER = ["order", "name", "kind", "scope", "uses", "errorRate", "tokens", "lastUsed", "findings"] as const;

function tokensOf(r: SetupRow): number {
  if (r.kind === "rule") return r.bytes > 0 ? Math.round(r.bytes / BYTES_PER_TOKEN) : -1;
  return r.usage?.avg_turn_tokens ?? -1;
}

/**
 * Which columns the current slice can fill (spec §4.4): every column, Tokens
 * included, is hidden when no row in `rows` could ever fill it.
 */
export function visibleColumnIds(kind: KindFilter, rows: SetupRow[], lens: boolean, usageKnown = true): string[] {
  const kinds = new Set(rows.map((r) => r.kind));
  const hasUsage = [...kinds].some((k) => USAGE_KINDS.has(k));
  const hasInstructions = kinds.has("rule");
  const hasTokens = rows.some((r) => tokensOf(r) >= 0);
  return ORDER.filter((id) => {
    if (id === "order") return lens && hasInstructions;
    if (id === "kind") return kind === "all";
    // Unknown usage (the lens still reading it, or failing to) is not "unused": no usage column at all.
    if (id === "uses" || id === "errorRate" || id === "lastUsed") return hasUsage && usageKnown;
    if (id === "tokens") return hasTokens;
    if (id === "findings") return hasInstructions;
    return true;
  });
}

function build(id: string, ctx: ColumnsCtx): ColumnDef<SetupRow, unknown> {
  const onlyUsage = (r: { kind: ArtifactKind }) => USAGE_KINDS.has(r.kind);
  switch (id) {
    case "order":
      return {
        id: "order",
        header: "#",
        meta: { align: "right", width: "44px" },
        accessorFn: (r) => r.load_order ?? Number.MAX_SAFE_INTEGER,
        cell: (c) => <span className="dt-num muted">{c.row.original.load_order ?? ""}</span>,
      };
    case "name":
      return nameColumn() as ColumnDef<SetupRow, unknown>;
    case "kind":
      return {
        id: "kind",
        header: "Kind",
        meta: { width: COLUMN_WIDTH.kind },
        accessorFn: (r) => KIND_SINGULAR[r.kind],
        cell: (c) => <span className="muted">{KIND_SINGULAR[c.row.original.kind]}</span>,
      };
    case "scope":
      return {
        id: "scope",
        header: "Scope",
        meta: { width: COLUMN_WIDTH.scope },
        accessorFn: (r) => scopeLabel(r, ctx.projectNames),
        cell: (c) => (
          <ScopeCell
            layer={c.row.original.layer}
            projectName={c.row.original.project_label ?? projectNameFor(c.row.original.path, ctx.projectNames)}
            pluginName={c.row.original.plugin_name}
          />
        ),
      };
    case "uses":
      return usesColumn(onlyUsage) as ColumnDef<SetupRow, unknown>;
    case "errorRate":
      return { ...(errorRateColumn() as ColumnDef<SetupRow, unknown>), header: "Errors" };
    case "tokens":
      return {
        id: "tokens",
        header: "Tokens",
        meta: { align: "right", width: COLUMN_WIDTH.avgTokens },
        accessorFn: tokensOf,
        cell: (c) => {
          const v = tokensOf(c.row.original);
          return v < 0 ? (
            <span className="dt-num muted">{EMPTY_MARK}</span>
          ) : (
            <TokensCell value={v} approx={c.row.original.kind === "rule"} />
          );
        },
      };
    case "lastUsed":
      return lastUsedColumn(onlyUsage) as ColumnDef<SetupRow, unknown>;
    case "findings":
      return {
        id: "findings",
        header: "Findings",
        meta: { align: "right", width: "84px" },
        accessorFn: (r) => r.issue_count ?? -1,
        cell: (c) => <FindingsCell count={c.row.original.issue_count} severity={c.row.original.worst_severity} />,
      };
    default:
      throw new Error(`unknown Setup column ${id}`);
  }
}

const cache = new WeakMap<ColumnsCtx, Map<string, ColumnDef<SetupRow, unknown>[]>>();

/** The columns for `ids`, identity-stable per `ctx` (`DataTable` needs stable columns). */
export function unifiedColumns(ids: string[], ctx: ColumnsCtx): ColumnDef<SetupRow, unknown>[] {
  let byKey = cache.get(ctx);
  if (!byKey) {
    byKey = new Map();
    cache.set(ctx, byKey);
  }
  const key = ids.join("|");
  let defs = byKey.get(key);
  if (!defs) {
    defs = ids.map((id) => build(id, ctx));
    byKey.set(key, defs);
  }
  return defs;
}
