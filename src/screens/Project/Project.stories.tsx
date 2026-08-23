import type { Meta, StoryObj } from "@storybook/react";
import type { ArtifactView, EffectiveRule, FileRow, ProjectRow, UsageStat } from "@/lib/ipc";
import { Project } from "./Project";
import type { ProjectData } from "./Project.types";
import "@/styles/shell.css";

const PATH = "/Users/dev/code/web-app";

const usage = (o: Partial<UsageStat> = {}): UsageStat => ({
  total: 24,
  sessions: 9,
  last_used: "2026-08-20T09:00:00.000Z",
  error_rate: 0,
  avg_turn_tokens: 900,
  count_30d: 12,
  count_prev_30d: 6,
  ...o,
});

const artifact = (o: Partial<ArtifactView> = {}): ArtifactView => ({
  id: 1,
  harness: "claude_code",
  layer: "project",
  kind: "skill",
  name: "pdf-extract",
  path: `${PATH}/.claude/skills/pdf-extract/SKILL.md`,
  plugin_name: null,
  description: null,
  bytes: 2048,
  grade: null,
  score: null,
  file_id: null,
  usage: null,
  ...o,
});

const file = (o: Partial<FileRow> = {}): FileRow => ({
  id: `${PATH}/CLAUDE.md`,
  name: "CLAUDE.md",
  path: `${PATH}/CLAUDE.md`,
  project: "web-app",
  project_id: PATH,
  kind: "CLAUDE.md",
  grade: "B",
  score: 81,
  issue_count: 4,
  modified: String(Math.floor(Date.now() / 1000) - 7200),
  ...o,
});

const rule = (o: Partial<EffectiveRule> = {}): EffectiveRule => ({
  layer: "project",
  path: `${PATH}/CLAUDE.md`,
  name: "CLAUDE.md",
  grade: "B",
  file_id: `${PATH}/CLAUDE.md`,
  ...o,
});

const project = (o: Partial<ProjectRow> = {}): ProjectRow => ({
  id: PATH,
  name: "web-app",
  grade: "B",
  score: 81,
  file_count: 3,
  issue_count: 12,
  logo: null,
  modified: null,
  harness: "claude_code",
  session_count: 41,
  last_session_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
  never_used_count: 2,
  error_count: 1,
  exists: true,
  ...o,
});

const sessionsPerDay = Array.from({ length: 90 }, (_, i) => ({
  day: `2026-06-${String((i % 28) + 1).padStart(2, "0")}`,
  count: [0, 0, 3, 1, 5, 2, 0][i % 7],
}));

const populated: ProjectData = {
  project: project(),
  files: [
    file(),
    file({
      id: `${PATH}/AGENTS.md`,
      name: "AGENTS.md",
      path: `${PATH}/AGENTS.md`,
      kind: "AGENTS.md",
      grade: "D",
      score: 54,
      issue_count: 11,
    }),
    file({
      id: `${PATH}/.claude/rules/testing.md`,
      name: "testing.md",
      path: `${PATH}/.claude/rules/testing.md`,
      kind: "rules",
      grade: "A",
      score: 95,
      issue_count: 0,
    }),
  ],
  setup: {
    harness: "claude_code",
    path: PATH,
    name: "web-app",
    exists: true,
    session_count: 41,
    last_session_at: new Date(Date.now() - 3 * 3_600_000).toISOString(),
    artifacts: [
      artifact({ id: 1, kind: "rule", name: "CLAUDE.md", path: `${PATH}/CLAUDE.md`, grade: "B", bytes: 4096, file_id: `${PATH}/CLAUDE.md` }),
      artifact({ id: 2, kind: "skill", name: "pdf-extract", description: "Pull tables out of PDFs", usage: usage() }),
      artifact({ id: 3, kind: "skill", name: "release-notes", usage: null, bytes: 900 }),
      artifact({ id: 4, kind: "agent", name: "code-reviewer", usage: usage({ total: 8, sessions: 4, error_rate: 0.25, avg_turn_tokens: 5400 }) }),
      artifact({ id: 5, kind: "command", name: "/ship", bytes: 320, usage: usage({ total: 3, sessions: 2 }) }),
      artifact({ id: 6, kind: "mcp_server", name: "github", usage: usage({ total: 61, sessions: 18, error_rate: 0.04, avg_turn_tokens: 2100 }) }),
      artifact({ id: 7, kind: "settings", name: "settings.json", path: `${PATH}/.claude/settings.json`, bytes: 1280 }),
    ],
  },
  effective: [
    rule({ layer: "project", name: "CLAUDE.md", grade: "B" }),
    rule({ layer: "global", name: "CLAUDE.md", path: "/Users/dev/.claude/CLAUDE.md", grade: "A" }),
    rule({ layer: "plugin", name: "conventions.md", path: "/Users/dev/.claude/plugins/office/CLAUDE.md", grade: null, file_id: null }),
  ],
  usage: {
    ranked: [
      { kind: "skill", target: "pdf-extract", artifact_id: 2, uses: 24, sessions: 9, error_rate: 0, avg_turn_tokens: 900 },
      { kind: "skill", target: "release-notes", artifact_id: 3, uses: 4, sessions: 2, error_rate: null, avg_turn_tokens: null },
      { kind: "agent", target: "code-reviewer", artifact_id: 4, uses: 8, sessions: 4, error_rate: 0.25, avg_turn_tokens: 5400 },
      { kind: "mcp", target: "mcp__github__create_issue", artifact_id: 6, uses: 61, sessions: 18, error_rate: 0.04, avg_turn_tokens: 2100 },
      { kind: "builtin", target: "Bash", artifact_id: null, uses: 210, sessions: 38, error_rate: 0.02, avg_turn_tokens: 1400 },
    ],
    sessions_per_day: sessionsPerDay,
  },
  lastScanAt: new Date(Date.now() - 27 * 3_600_000).toISOString(),
  harness: "claude_code",
  harnessName: "Claude Code",
};

/** The same project, with the folder gone from disk since the last scan. */
const missingFolder: ProjectData = {
  ...populated,
  project: project({ exists: false, grade: "D", score: 58 }),
};

/**
 * A folder nothing has ever run in: files were scanned and graded, but there
 * is no harness to have a load order or any usage.
 */
const noHarness: ProjectData = {
  ...populated,
  project: project({ harness: null, session_count: 0, last_session_at: null }),
  effective: [],
  usage: null,
  harness: null,
  harnessName: null,
};

/** Scanned, and holding nothing at all — every tab has to say so on its own. */
const empty: ProjectData = {
  project: project({ grade: "F", score: 0, file_count: 0, issue_count: 0, session_count: 0, last_session_at: null, never_used_count: 0 }),
  files: [],
  setup: null,
  effective: [],
  usage: { ranked: [], sessions_per_day: [] },
  lastScanAt: new Date(Date.now() - 2 * 3_600_000).toISOString(),
  harness: "claude_code",
  harnessName: "Claude Code",
};

/**
 * Tables and tab strips remember their state in `sessionStorage`, which
 * outlives a story swap — so every story starts from a clean slate. Written
 * during the decorator's render, before the page below it mounts and reads.
 */
const clearRememberedState = () => {
  for (const key of Object.keys(window.sessionStorage)) {
    if (key.startsWith("pj.table.") || key.startsWith("pj.tabs.")) {
      window.sessionStorage.removeItem(key);
    }
  }
};

/**
 * One project, end to end. Storybook feeds the screen a fixture through the
 * `data` prop — in the app it comes from `useProject`.
 */
const meta = {
  title: "Screens/Project",
  component: Project,
  args: { path: PATH, navigate: () => {}, data: populated },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => {
      clearRememberedState();
      return (
        <div style={{ height: "100vh", background: "var(--bg)" }}>
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<typeof Project>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Graded files, a three-layer rule stack, a full inventory and 90 days of usage. */
export const Populated: Story = {};

/** The harness remembers the project; the disk has lost the folder. */
export const MissingFolder: Story = { args: { data: missingFolder } };

/** No harness has worked here, so two of the four tabs have nothing to ask. */
export const NoHarness: Story = { args: { data: noHarness } };

/** Scanned and empty — every tab says which kind of nothing it is showing. */
export const Empty: Story = { args: { data: empty } };

/** The route was reached without a project to open. */
export const NoSelection: Story = { args: { path: undefined, data: null } };

/** The read failed — never rendered as "this project is empty". */
export const Unreadable: Story = { args: { data: null } };
