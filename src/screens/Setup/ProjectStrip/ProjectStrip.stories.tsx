import type { Meta, StoryObj } from "@storybook/react";
import type { ProjectSetup } from "@/lib/ipc";
import { ProjectStrip } from "./ProjectStrip";
import "@/styles/shell.css";

const project: ProjectSetup = {
  harness: "claude_code",
  path: "/code/web",
  name: "web",
  exists: true,
  session_count: 148,
  last_session_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  artifacts: [],
};

const meta = {
  title: "Screens/Setup/ProjectStrip",
  component: ProjectStrip,
  args: { project, sessionsPerDay: null, onReveal: () => {} },
  parameters: { layout: "padded" },
} satisfies Meta<typeof ProjectStrip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  args: { sessionsPerDay: Array.from({ length: 30 }, (_, i) => ({ day: `2026-09-${String(i + 1).padStart(2, "0")}`, count: (i * 7) % 6 })) },
};

/** No harness has worked here, or the usage read failed. */
export const NoSessions: Story = { args: { project: { ...project, session_count: 0, last_session_at: null } } };

export const MissingFolder: Story = { args: { project: { ...project, exists: false } } };
