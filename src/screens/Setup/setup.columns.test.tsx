import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import type { ArtifactView, UsageStat } from "@/lib/ipc";
import { DataTable } from "@/components/DataTable";
import { lastUsedColumn, usesColumn } from "./setup.columns";

const openExternal = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("@/lib/open-external", () => ({ openExternal }));

afterEach(cleanup);

const usage = (o: Partial<UsageStat> = {}): UsageStat => ({
  total: 9,
  sessions: 4,
  last_used: "2026-08-19T10:00:00.000Z",
  error_rate: 0,
  avg_turn_tokens: 800,
  count_30d: 2,
  count_prev_30d: 1,
  ...o,
});

const artifact = (o: Partial<ArtifactView> = {}): ArtifactView => ({
  id: 1,
  harness: "claude_code",
  layer: "global",
  kind: "rule",
  name: "a",
  path: "/a.md",
  plugin_name: null,
  description: null,
  bytes: 10,
  grade: null,
  score: null,
  file_id: null,
  issue_count: null,
  worst_severity: null,
  usage: null,
  ...o,
});

let mountCount = 0;

/**
 * The usage builders the unified table composes: one grid mixing kinds, so a
 * column must stay silent about rows it cannot make a claim about.
 */
describe("shared column builders", () => {
  /** Mounts an ad-hoc column list — the builders under test, not a whole kind. */
  function mountColumns(columns: ReturnType<typeof usesColumn>[], rows: ArtifactView[]) {
    mountCount += 1;
    return render(
      <DataTable
        columns={columns}
        rows={rows}
        rowId={(r) => String(r.id)}
        empty={{ title: "Nothing here" }}
        stateKey={`test-shared-${mountCount}`}
        ariaLabel="Artifacts"
      />,
    );
  }

  it("says never for an artifact that could have been invoked and wasn't", () => {
    mountColumns([lastUsedColumn()], [artifact({ kind: "skill", usage: null })]);
    expect(screen.getByText("never")).toBeInTheDocument();
  });

  it("makes no usage claim about a kind nothing can invoke", () => {
    // A rule file is loaded, never called: "never" would read as a finding
    // about the rule rather than a fact about the column, so the guarded
    // columns fall back to the em dash every unknown value uses.
    const guard = (r: ArtifactView) => r.kind !== "rule";
    mountColumns(
      [usesColumn(guard), lastUsedColumn(guard)],
      [artifact({ kind: "rule", usage: null })],
    );
    expect(screen.queryByText("never")).not.toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });

  it("still reports usage for an invocable row under the same guard", () => {
    const guard = (r: ArtifactView) => r.kind !== "rule";
    mountColumns(
      [usesColumn(guard), lastUsedColumn(guard)],
      [artifact({ kind: "skill", usage: usage({ total: 9 }) })],
    );
    expect(screen.getByText("9")).toBeInTheDocument();
  });
});
