import type { Meta, StoryObj } from "@storybook/react";
import { UsageTabBody } from "./UsageTab";
import type { UsageOverview } from "@/lib/ipc";

/** Deterministic pseudo-usage so the story never churns between snapshots. */
const rankedRow = (
  target: string,
  uses: number,
  kind: UsageOverview["ranked"][number]["kind"],
): UsageOverview["ranked"][number] => ({
  kind,
  target,
  artifact_id: null,
  uses,
  sessions: Math.max(1, Math.round(uses / 4)),
  error_rate: (uses % 5) / 10,
  avg_turn_tokens: uses % 2 === 0 ? null : uses * 210,
});

const sample: UsageOverview = {
  window_days: 90,
  ranked: [
    rankedRow("dataviz", 61, "skill"),
    rankedRow("playwright", 48, "mcp"),
    // Same name, two kinds — the list keys rows by kind:target.
    rankedRow("adapt", 33, "skill"),
    rankedRow("adapt", 21, "agent"),
    rankedRow("Bash", 12, "builtin"),
  ],
  by_kind: [
    { kind: "skill", total: 148, avg_turn_tokens: 21480.6 },
    { kind: "agent", total: 62, avg_turn_tokens: 30140 },
    { kind: "mcp", total: 97, avg_turn_tokens: null },
    { kind: "builtin", total: 512, avg_turn_tokens: 8120 },
  ],
  sessions_per_project: [
    { path: "/code/prompt-janitor", name: "prompt-janitor", sessions: 34 },
    { path: "/code/landing", name: "landing", sessions: 12 },
    { path: "/code/fulfillment", name: "fulfillment", sessions: 5 },
    { path: "/code/archive", name: "archive", sessions: 0 },
  ],
  mcp_error_rates: [
    { target: "playwright", total: 61, error_rate: 0.34 },
    { target: "supabase", total: 26, error_rate: 0.08 },
    { target: "railway", total: 10, error_rate: null },
  ],
};

const meta = {
  title: "Screens/Analytics/UsageTab",
  component: UsageTabBody,
  args: { data: sample },
  // The tab lives in a full-width screen, not a centred card — render it the
  // way the app does so the axis labels get the room they get in production.
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="page" style={{ width: 920 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof UsageTabBody>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SingleTarget: Story = {
  args: {
    data: {
      ...sample,
      ranked: [sample.ranked[0]],
      mcp_error_rates: [],
      sessions_per_project: [],
    },
  },
};
