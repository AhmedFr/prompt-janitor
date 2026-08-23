import type { Meta, StoryObj } from "@storybook/react";
import type { FileRow } from "@/lib/ipc";
import { Prompts } from "./Prompts";
import "@/styles/shell.css";

const DAY = 86_400;
const ago = (days: number) => String(Math.floor(Date.now() / 1000) - days * DAY);

const file = (o: Partial<FileRow> = {}): FileRow => ({
  id: "/Users/dev/code/api/CLAUDE.md",
  name: "CLAUDE.md",
  path: "/Users/dev/code/api/CLAUDE.md",
  project: "api",
  project_id: "/Users/dev/code/api",
  kind: "CLAUDE.md",
  grade: "B",
  score: 80,
  issue_count: 2,
  modified: ago(3),
  ...o,
});

/** Four projects' worth of files, across the kinds the scanner classifies. */
const populated: FileRow[] = [
  file({
    id: "/Users/dev/code/prompt-janitor/CLAUDE.md",
    path: "/Users/dev/code/prompt-janitor/CLAUDE.md",
    project: "prompt-janitor",
    project_id: "/Users/dev/code/prompt-janitor",
    grade: "A",
    score: 94,
    issue_count: 0,
    modified: ago(0),
  }),
  file({
    id: "/Users/dev/code/prompt-janitor/docs/CLAUDE.md",
    name: "CLAUDE.md",
    path: "/Users/dev/code/prompt-janitor/docs/CLAUDE.md",
    project: "prompt-janitor",
    project_id: "/Users/dev/code/prompt-janitor",
    grade: "B",
    score: 84,
    issue_count: 1,
    modified: ago(9),
  }),
  file({
    id: "/Users/dev/code/web-app/AGENTS.md",
    name: "AGENTS.md",
    path: "/Users/dev/code/web-app/AGENTS.md",
    project: "web-app",
    project_id: "/Users/dev/code/web-app",
    kind: "AGENTS.md",
    grade: "C",
    score: 68,
    issue_count: 14,
    modified: ago(21),
  }),
  file(),
  file({
    id: "/Users/dev/code/scripts/.cursorrules",
    name: ".cursorrules",
    path: "/Users/dev/code/scripts/.cursorrules",
    project: "scripts",
    project_id: "/Users/dev/code/scripts",
    kind: ".cursorrules",
    grade: "F",
    score: 38,
    issue_count: 22,
    modified: ago(140),
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
 * Every graded prompt file as one flat table. Storybook feeds the screen a
 * fixture through the `data` prop — in the app it comes from `usePromptsList`.
 */
const meta = {
  title: "Screens/Prompts",
  component: Prompts,
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
} satisfies Meta<typeof Prompts>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Five files across four projects, graded, with kinds and open issue counts. */
export const Populated: Story = {};

/** Nothing scanned yet — the table says so rather than showing an empty grid. */
export const Empty: Story = {
  args: { data: [] },
};

/** Arrived from a project: the Project pill lands preselected to that project. */
export const DeepLinked: Story = {
  args: { target: "/Users/dev/code/prompt-janitor" },
};
