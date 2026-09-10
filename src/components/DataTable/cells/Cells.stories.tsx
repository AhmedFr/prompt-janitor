import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  ActionsCell,
  CountCell,
  GradeCell,
  LastUsedCell,
  PathCell,
  PercentCell,
  ScopeCell,
  TokensCell,
} from "./index";

/** Relative ages are read off the wall clock, so the story dates are offsets from it. */
const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString();

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
        <Row label="CountCell">
          <CountCell value={12345} /> · <CountCell value={9} /> · <CountCell value={0} /> ·{" "}
          <CountCell value={null} />
        </Row>
        <Row label="LastUsedCell">
          <span style={{ display: "inline-flex", gap: 10, flexWrap: "wrap" }}>
            <LastUsedCell lastUsed={hoursAgo(0.2)} />
            <LastUsedCell lastUsed={hoursAgo(5)} />
            <LastUsedCell lastUsed={hoursAgo(24 * 3)} />
            <LastUsedCell lastUsed={hoursAgo(24 * 140)} />
            <LastUsedCell lastUsed={null} />
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
            <ScopeCell layer="plugin" pluginName="posthog" />
            <ScopeCell layer="plugin" pluginName={null} />
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
