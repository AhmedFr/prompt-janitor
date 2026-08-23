import type { Meta, StoryObj } from "@storybook/react";
import type { ProjectRow } from "@/lib/ipc";
import { ProjectHeader } from "./ProjectHeader";
import "@/styles/shell.css";

const HOUR = 3_600_000;
const agoIso = (ms: number) => new Date(Date.now() - ms).toISOString();

const project = (o: Partial<ProjectRow> = {}): ProjectRow => ({
  id: "/Users/dev/code/web-app",
  name: "web-app",
  grade: "B",
  score: 81,
  file_count: 3,
  issue_count: 12,
  logo: null,
  modified: null,
  harness: "claude_code",
  session_count: 41,
  last_session_at: agoIso(3 * HOUR),
  never_used_count: 2,
  error_count: 1,
  exists: true,
  ...o,
});

const meta = {
  title: "Screens/Project/ProjectHeader",
  component: ProjectHeader,
  args: { project: project(), lastScanAt: agoIso(27 * HOUR) },
  parameters: { layout: "padded" },
} satisfies Meta<typeof ProjectHeader>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A project worked in this morning, graded from three files. */
export const Default: Story = {};

/** Top of the scale — the ring carries the whole verdict. */
export const TopGrade: Story = { args: { project: project({ grade: "A", score: 96 }) } };

/** Scanned, never opened: the two recency facts have to say so rather than guess. */
export const NeverWorkedIn: Story = {
  args: {
    project: project({ grade: "F", score: 34, session_count: 0, last_session_at: null }),
    lastScanAt: null,
  },
};
