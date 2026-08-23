import type { Meta, StoryObj } from "@storybook/react";
import type { PanelSnapshot } from "@/lib/ipc";
import { PanelHeader } from "./PanelHeader";

const snapshot: PanelSnapshot = {
  has_data: true,
  overall_grade: "C",
  overall_score: 72,
  delta: 3,
  last_scan_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  top_fixes: [],
  never_used_skills: 0,
  mcp_erroring: 0,
  sessions_today: 0,
};

/** The panel's ten-second answer: grade, verdict, direction, age. */
const meta = {
  title: "Screens/Panel/PanelHeader",
  component: PanelHeader,
  args: { snapshot },
  decorators: [
    (Story) => (
      <div style={{ width: 360, background: "var(--card)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PanelHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A graded setup that has moved up since the last scan. */
export const Graded: Story = {};

/** A setup that got worse — the arrow carries the sign. */
export const Worsened: Story = {
  args: { snapshot: { ...snapshot, overall_grade: "F", overall_score: 41, delta: -6 } },
};

/** Nothing measured yet. */
export const NoScan: Story = {
  args: { snapshot: { ...snapshot, has_data: false, last_scan_at: null, delta: 0 } },
};
