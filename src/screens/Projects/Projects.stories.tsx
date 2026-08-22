import type { Meta, StoryObj } from "@storybook/react";
import type { ProjectRow } from "@/lib/ipc";
import { Projects } from "./Projects";
import "@/styles/shell.css";

const project = (o: Partial<ProjectRow> = {}): ProjectRow => ({
  id: "/Users/dev/code/project",
  name: "project",
  grade: "B",
  score: 80,
  file_count: 3,
  issue_count: 2,
  logo: null,
  modified: null,
  harness: "claude_code",
  session_count: 12,
  last_session_at: "2026-08-20T09:00:00.000Z",
  never_used_count: 0,
  error_count: 0,
  exists: true,
  ...o,
});

const populated: ProjectRow[] = [
  project({
    id: "/Users/dev/code/prompt-janitor",
    name: "prompt-janitor",
    grade: "A",
    score: 94,
    file_count: 6,
    issue_count: 1,
    session_count: 96,
    last_session_at: "2026-08-20T08:30:00.000Z",
    never_used_count: 1,
  }),
  project({
    id: "/Users/dev/code/web-app",
    name: "web-app",
    grade: "C",
    score: 68,
    file_count: 4,
    issue_count: 14,
    session_count: 41,
    last_session_at: "2026-08-11T17:05:00.000Z",
    never_used_count: 3,
    error_count: 1,
  }),
  project({
    id: "/Users/dev/code/api",
    name: "api",
    grade: "C",
    score: 71,
    file_count: 2,
    issue_count: 3,
    session_count: 7,
    last_session_at: "2026-07-02T11:00:00.000Z",
    never_used_count: 0,
  }),
  project({
    id: "/Users/dev/code/scripts",
    name: "scripts",
    grade: "F",
    score: 38,
    file_count: 1,
    issue_count: 22,
    session_count: 0,
    last_session_at: null,
    never_used_count: 5,
    error_count: 2,
    harness: null,
  }),
];

/** The same set, plus a project whose folder has been moved or deleted. */
const withMissingFolder: ProjectRow[] = [
  ...populated,
  project({
    id: "/Users/dev/code/old-prototype",
    name: "old-prototype",
    grade: "D",
    score: 55,
    file_count: 2,
    issue_count: 8,
    session_count: 19,
    last_session_at: "2026-03-14T09:00:00.000Z",
    never_used_count: 2,
    exists: false,
  }),
];

/**
 * Tables remember their search, pills and sort in `sessionStorage`, which
 * outlives a story swap — so every story starts from a clean slate. Written
 * during the decorator's render, before the table below it mounts and reads.
 */
const clearTableState = () => {
  for (const key of Object.keys(window.sessionStorage)) {
    if (key.startsWith("pj.table.")) window.sessionStorage.removeItem(key);
  }
};

/**
 * Every scanned project as one comparable table. Storybook feeds the screen a
 * fixture through the `data` prop — in the app it comes from `useProjects`.
 */
const meta = {
  title: "Screens/Projects",
  component: Projects,
  args: { navigate: () => {}, data: populated },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => {
      clearTableState();
      return (
        <div style={{ height: "100vh", background: "var(--bg)" }}>
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<typeof Projects>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Four projects, graded, with sessions and never-used counts. */
export const Populated: Story = {};

/** Nothing scanned yet — the table says so rather than showing an empty grid. */
export const Empty: Story = {
  args: { data: [] },
};

/** A project the harness remembers and the disk has lost. */
export const MissingFolder: Story = {
  args: { data: withMissingFolder },
};
