import type { Meta, StoryObj } from "@storybook/react";
import type { TrendPoint } from "@/lib/ipc";
import { TrendChart } from "./TrendChart";
import { scoreGradeDetail } from "./trendChart.util";
import "@/styles/shell.css";

const START = 1_786_000_000; // an epoch in Aug 2026

/** `count` scans, `stepHours` apart, wandering around a slowly rising score. */
function scans(count: number, stepHours: number): TrendPoint[] {
  return Array.from({ length: count }, (_, i) => ({
    t: String(START + i * stepHours * 3600),
    score: Math.max(0, Math.min(100, 58 + Math.round(Math.sin(i / 3) * 9) + Math.round((i * 20) / count))),
  }));
}

const sessions = Array.from({ length: 30 }, (_, i) => ({
  day: `2026-07-${String((i % 28) + 1).padStart(2, "0")}`,
  count: [0, 1, 4, 2, 0, 7, 3][i % 7],
}));

const meta = {
  title: "Components/TrendChart",
  component: TrendChart,
  parameters: { layout: "padded" },
  args: { valueDetail: scoreGradeDetail },
  decorators: [
    (Story) => (
      // ResponsiveContainer measures its parent, so it needs one with a width.
      <div style={{ width: 640, background: "var(--card)", padding: 16, borderRadius: 12 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TrendChart>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The smallest trend the Overview draws: two scans. */
export const TwoScans: Story = { args: { data: scans(2, 30) } };

/** The Overview's window: the last seven scans, about a day apart. */
export const SevenScans: Story = { args: { data: scans(7, 26) } };

/** A quarter of daily scans on Analytics: the x labels thin out instead of colliding. */
export const NinetyScans: Story = { args: { data: scans(90, 24) } };

/** A narrow card: the end marker stays a circle and the labels thin out. */
export const NarrowCard: Story = {
  args: { data: scans(7, 26) },
  decorators: [(Story) => <div style={{ width: 280 }}><Story /></div>],
};

/** A count series has no ceiling, so it scales to its own maximum instead. */
export const SessionsPerDay: Story = {
  args: {
    data: sessions,
    xKey: "day",
    dataKey: "count",
    domain: [0, "auto"],
    ariaLabel: "Sessions per day",
    height: 120,
    valueDetail: undefined,
  },
};

/** Nothing recorded yet — the axes hold their shape rather than collapsing. */
export const Empty: Story = { args: { data: [] } };
