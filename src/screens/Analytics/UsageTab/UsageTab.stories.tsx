import type { Meta, StoryObj } from "@storybook/react";
import { UsageTabBody } from "./UsageTab";
import type { UsageOverview } from "@/lib/ipc";

const DAYS = Array.from({ length: 14 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`);

/** Deterministic pseudo-usage so the story never churns between snapshots. */
const seriesFor = (target: string, seed: number, kind: UsageOverview["top"][number]["kind"]) => ({
  kind,
  target,
  points: DAYS.filter((_, i) => (i + seed) % 3 !== 0).map((day, i) => ({
    day,
    count: 2 + ((i * seed) % 9),
    errors: (i * seed) % 5 === 0 ? 1 : 0,
  })),
});

const sample: UsageOverview = {
  top: [
    seriesFor("dataviz", 1, "skill"),
    seriesFor("playwright", 2, "mcp"),
    // Same name, two kinds — the chart keys columns by kind:target and only
    // then disambiguates the labels.
    seriesFor("adapt", 3, "skill"),
    seriesFor("adapt", 4, "agent"),
    seriesFor("Bash", 5, "builtin"),
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
    data: { ...sample, top: [sample.top[0]], mcp_error_rates: [], sessions_per_project: [] },
  },
};
