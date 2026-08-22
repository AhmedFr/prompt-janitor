import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import type { UsageStat } from "@/lib/ipc";
import { ActionsCell, GradeCell, PathCell, PercentCell, ScopeCell, TokensCell, UsageCell } from "./index";

const NOW = new Date("2026-08-20T12:00:00.000Z");

const usage = (o: Partial<UsageStat> = {}): UsageStat => ({
  total: 24,
  sessions: 9,
  last_used: "2026-08-19T12:00:00.000Z",
  error_rate: 0,
  avg_turn_tokens: 900,
  count_30d: 12,
  count_prev_30d: 6,
  ...o,
});

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <tr>
      <th scope="row" style={{ textAlign: "left", padding: "6px 16px 6px 0", fontSize: 12, color: "var(--text-3)" }}>
        {label}
      </th>
      <td style={{ padding: "6px 0" }}>{children}</td>
    </tr>
  );
}

const meta = {
  title: "Components/DataTable/Cells",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Every cell the shared tables draw, in one place, in their real type states. */
export const AllCells: Story = {
  render: () => (
    <table>
      <tbody>
        <Row label="GradeCell">
          <span style={{ display: "inline-flex", gap: 6 }}>
            <GradeCell grade="A" />
            <GradeCell grade="C" />
            <GradeCell grade="F" />
            <GradeCell grade={null} />
          </span>
        </Row>
        <Row label="UsageCell">
          <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
            <UsageCell usage={usage()} now={NOW} />
            <UsageCell usage={null} now={NOW} />
            <UsageCell usage={usage({ error_rate: 0.4 })} now={NOW} />
            <UsageCell usage={usage({ last_used: "2026-04-02T12:00:00.000Z" })} now={NOW} />
          </span>
        </Row>
        <Row label="PercentCell">
          <PercentCell value={0.42} /> · <PercentCell value={0} /> · <PercentCell value={null} />
        </Row>
        <Row label="TokensCell">
          <TokensCell value={1234567} /> · <TokensCell value={840} /> · <TokensCell value={null} />
        </Row>
        <Row label="ScopeCell">
          <span style={{ display: "inline-flex", gap: 6 }}>
            <ScopeCell layer="global" />
            <ScopeCell layer="project" projectName="acme-api" />
            <ScopeCell layer="project" projectName={null} />
            <ScopeCell layer="plugin" />
          </span>
        </Row>
        <Row label="PathCell">
          <PathCell path="/Users/ada/.claude/plugins/office/skills/pdf-extract/SKILL.md" />
        </Row>
        <Row label="ActionsCell">
          <ActionsCell
            actions={[
              { label: "Open in editor", icon: "wand", onClick: () => {} },
              { label: "Refresh", icon: "refresh", onClick: () => {} },
              { label: "Remove", icon: "x", onClick: () => {} },
            ]}
          />
        </Row>
      </tbody>
    </table>
  ),
};
