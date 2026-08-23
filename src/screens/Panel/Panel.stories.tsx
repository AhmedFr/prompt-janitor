import type { Meta, StoryObj } from "@storybook/react";
import type { PanelSnapshot } from "@/lib/ipc";
import { Panel } from "./Panel";

const populated: PanelSnapshot = {
  has_data: true,
  overall_grade: "C",
  overall_score: 72,
  delta: 3,
  last_scan_at: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  top_fixes: [
    {
      file_id: "/Users/dev/code/acme-api/CLAUDE.md",
      name: "CLAUDE.md",
      project_name: "acme-api",
      grade: "F",
      issue_count: 6,
    },
    {
      file_id: "/Users/dev/code/web-app/AGENTS.md",
      name: "AGENTS.md",
      project_name: "web-app",
      grade: "D",
      issue_count: 4,
    },
    {
      file_id: "/Users/dev/code/web-app/.claude/skills/deploy/SKILL.md",
      name: "SKILL.md",
      project_name: "web-app",
      grade: "C",
      issue_count: 2,
    },
  ],
  never_used_skills: 3,
  mcp_erroring: 1,
  sessions_today: 12,
};

const noScan: PanelSnapshot = {
  ...populated,
  has_data: false,
  overall_score: 0,
  delta: 0,
  last_scan_at: null,
  top_fixes: [],
  never_used_skills: 0,
  mcp_erroring: 0,
  sessions_today: 0,
};

/**
 * The menu-bar popover, at the size the panel window actually is (360 × 480).
 * Storybook feeds it a fixture through the `data` prop — in the app it comes
 * from `usePanel`, which has no Tauri runtime to talk to here.
 */
const meta = {
  title: "Screens/Panel",
  component: Panel,
  args: { data: populated },
  parameters: { layout: "centered" },
  decorators: [
    (Story) => (
      <div style={{ width: 360, height: 480, position: "relative" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Panel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A graded setup: verdict, three fixes, three usage signals. */
export const Populated: Story = {};

/** Before the first scan there is no verdict to give — only the offer to measure. */
export const NoScan: Story = {
  args: { data: noScan },
};

/** A scan is running: the button is locked and the bar narrates it. */
export const Scanning: Story = {
  args: { scanning: true },
};

/** The snapshot query failed — the panel says so rather than showing a blank card. */
export const Failure: Story = {
  args: { failed: true },
};
