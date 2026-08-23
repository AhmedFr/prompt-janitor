import type { Meta, StoryObj } from "@storybook/react";
import type { TrendPoint } from "@/lib/ipc";
import { TrendChart } from "./TrendChart";
import "@/styles/shell.css";

const trend: TrendPoint[] = Array.from({ length: 24 }, (_, i) => ({
  t: String(1_700_000_000 + i * 86_400),
  score: 58 + Math.round(Math.sin(i / 3) * 9) + i,
}));

const sessions = Array.from({ length: 30 }, (_, i) => ({
  day: `2026-07-${String((i % 28) + 1).padStart(2, "0")}`,
  count: [0, 1, 4, 2, 0, 7, 3][i % 7],
}));

const meta = {
  title: "Components/TrendChart",
  component: TrendChart,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      // ResponsiveContainer measures its parent, so it needs one with a width.
      <div style={{ width: 520, background: "var(--card)", padding: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TrendChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What the chart was written for: an overall score on a fixed 0–100 axis. */
export const HealthTrend: Story = { args: { data: trend } };

/** A count series has no ceiling, so it scales to its own maximum instead. */
export const SessionsPerDay: Story = {
  args: {
    data: sessions,
    xKey: "day",
    dataKey: "count",
    domain: [0, "auto"],
    ariaLabel: "Sessions per day",
    height: 120,
  },
};

/** Nothing recorded yet — the axes hold their shape rather than collapsing. */
export const Empty: Story = { args: { data: [] } };
