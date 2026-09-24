import type { ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import {
  ActionsCell,
  CountCell,
  GradeCell,
  LastUsedCell,
  NameCell,
  PathCell,
  PercentCell,
  ScopeCell,
  TokensCell,
} from "./index";

/**
 * `LastUsedCell` reads relative ages off the wall clock, so the story dates are
 * offsets from a fixed base rather than from `Date.now()` — otherwise every
 * snapshot of this story differs from the last by however long ago it was taken.
 */
const NOW = new Date("2026-08-20T12:00:00.000Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

/** Setup's Error % lines, spelled out so the story does not import a screen. */
const ERROR_BANDS = { watch: 0.1, bad: 0.25 };

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
        <Row label="NameCell">
          {/* In a 240px column, which is what a nine-column table leaves it. */}
          <span style={{ display: "block", width: 240 }}>
            <NameCell
              name="running-a-feature-workflow"
              description="Ship a change through issue, branch, TDD, local gates, PR, review and squash-merge"
            />
          </span>
          <span style={{ display: "block", width: 240 }}>
            <NameCell name="deploy" description={null} />
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
        <Row label="PercentCell · bands">
          <span style={{ display: "inline-flex", gap: 12 }}>
            <PercentCell value={0.02} thresholds={ERROR_BANDS} />
            <PercentCell value={0.12} thresholds={ERROR_BANDS} />
            <PercentCell value={0.4} thresholds={ERROR_BANDS} />
            <PercentCell value={null} thresholds={ERROR_BANDS} />
          </span>
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

/** Each Error % band on its own, as Setup tones them: good, watch, bad, unknown. */
export const RateBands: Story = {
  render: () => (
    <table>
      <tbody>
        <Row label="good · 2%">
          <PercentCell value={0.02} thresholds={ERROR_BANDS} />
        </Row>
        <Row label="good · 0%">
          <PercentCell value={0} thresholds={ERROR_BANDS} />
        </Row>
        <Row label="watch · 12%">
          <PercentCell value={0.12} thresholds={ERROR_BANDS} />
        </Row>
        <Row label="bad · 25% (on the line)">
          <PercentCell value={0.25} thresholds={ERROR_BANDS} />
        </Row>
        <Row label="bad · 80%">
          <PercentCell value={0.8} thresholds={ERROR_BANDS} />
        </Row>
        <Row label="unknown">
          <PercentCell value={null} thresholds={ERROR_BANDS} />
        </Row>
      </tbody>
    </table>
  ),
};

/** One tint per layer, so a Scope column reads as three groups. */
export const ScopeLayers: Story = {
  render: () => (
    <table>
      <tbody>
        <Row label="global">
          <ScopeCell layer="global" />
        </Row>
        <Row label="project">
          <ScopeCell layer="project" projectName="acme-api" />
        </Row>
        <Row label="project · unnamed">
          <ScopeCell layer="project" projectName={null} />
        </Row>
        <Row label="plugin">
          <ScopeCell layer="plugin" pluginName="posthog" />
        </Row>
        <Row label="plugin · unnamed">
          <ScopeCell layer="plugin" pluginName={null} />
        </Row>
      </tbody>
    </table>
  ),
};

/** Unknown values recede to a muted em dash; a real zero stays full ink. */
export const UnknownValues: Story = {
  render: () => (
    <table>
      <tbody>
        <Row label="CountCell">
          <CountCell value={null} /> vs <CountCell value={0} />
        </Row>
        <Row label="TokensCell">
          <TokensCell value={null} /> vs <TokensCell value={0} />
        </Row>
        <Row label="PercentCell">
          <PercentCell value={null} /> vs <PercentCell value={0} />
        </Row>
      </tbody>
    </table>
  ),
};
