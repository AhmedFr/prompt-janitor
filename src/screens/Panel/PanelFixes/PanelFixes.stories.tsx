import type { Meta, StoryObj } from "@storybook/react";
import type { PanelFix } from "@/lib/ipc";
import { PanelFixes } from "./PanelFixes";

const fixes: PanelFix[] = [
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
];

/** The three files worth opening the app for. */
const meta = {
  title: "Screens/Panel/PanelFixes",
  component: PanelFixes,
  args: { fixes, onOpen: () => {} },
  decorators: [
    (Story) => (
      <div style={{ width: 360, background: "var(--card)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PanelFixes>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three ranked rows, worst grade first. */
export const Populated: Story = {};

/** Everything graded is clean. */
export const NothingToFix: Story = {
  args: { fixes: [] },
};
