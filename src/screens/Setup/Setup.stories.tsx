import type { Meta, StoryObj } from "@storybook/react";
import { Setup } from "./Setup";
import type { ArtifactView, SetupView, UsageStat } from "@/lib/ipc";
import "@/styles/shell.css";

const usage = (o: Partial<UsageStat> = {}): UsageStat => ({
  total: 24,
  sessions: 9,
  last_used: "2026-08-19T10:00:00.000Z",
  error_rate: 0,
  avg_turn_tokens: 900,
  count_30d: 6,
  count_prev_30d: 4,
  ...o,
});

const artifact = (o: Partial<ArtifactView> = {}): ArtifactView => ({
  id: 1,
  harness: "claude_code",
  layer: "global",
  kind: "rule",
  name: "artifact",
  path: "/home/u/.claude/artifact.md",
  plugin_name: null,
  description: null,
  bytes: 1024,
  grade: null,
  score: null,
  file_id: null,
  usage: null,
  ...o,
});

const populated: SetupView = {
  harnesses: [
    {
      id: "claude_code",
      display_name: "Claude Code",
      detected: true,
      last_scan_at: "2026-08-20T09:00:00.000Z",
      project_count: 32,
      session_count: 177,
    },
  ],
  global: [
    artifact({
      id: 1,
      kind: "rule",
      name: "CLAUDE.md",
      description: "Global instructions loaded into every session.",
      grade: "B",
      score: 81,
      file_id: "f-global",
      usage: usage({ total: 177, sessions: 177, avg_turn_tokens: 1100 }),
    }),
    artifact({
      id: 2,
      kind: "skill",
      name: "systematic-debugging",
      description: "Structured root-cause workflow before proposing a fix.",
      usage: usage({ total: 31, sessions: 14, avg_turn_tokens: 1400 }),
    }),
    artifact({
      id: 3,
      kind: "skill",
      name: "writing-plans",
      description: "Turns a spec into a step-by-step implementation plan.",
      usage: null,
    }),
    artifact({
      id: 4,
      kind: "agent",
      name: "code-reviewer",
      description: "Reviews a diff against the project's conventions.",
      usage: usage({ total: 4, sessions: 3, avg_turn_tokens: 6200 }),
    }),
    artifact({
      id: 5,
      kind: "mcp_server",
      name: "linear",
      description: "Linear issue tracker integration.",
      usage: usage({ total: 40, sessions: 12, error_rate: 0.42, avg_turn_tokens: 700 }),
    }),
    artifact({ id: 6, kind: "hook", name: "pre-commit-format", usage: null }),
  ],
  projects: [
    {
      harness: "claude_code",
      path: "/Users/dev/code/prompt-janitor",
      name: "prompt-janitor",
      exists: true,
      session_count: 96,
      last_session_at: "2026-08-20T08:30:00.000Z",
      artifacts: [
        artifact({
          id: 7,
          layer: "project",
          kind: "rule",
          name: "CLAUDE.md",
          description: "Project instructions: status dashboard, ship process.",
          grade: "A",
          score: 94,
          file_id: "f-pj",
          usage: usage({ total: 96, sessions: 96, avg_turn_tokens: 1200 }),
        }),
        artifact({
          id: 8,
          layer: "project",
          kind: "command",
          name: "ship",
          description: "Branch, PR and status-dashboard update in one go.",
          usage: usage({ total: 11, sessions: 8, avg_turn_tokens: 3000 }),
        }),
        artifact({
          id: 9,
          layer: "project",
          kind: "agent",
          name: "release-notes",
          description: "Drafts the changelog entry for a merged PR.",
          usage: null,
        }),
      ],
    },
    {
      harness: "claude_code",
      path: "/Users/dev/code/old-experiment",
      name: "old-experiment",
      exists: false,
      session_count: 3,
      last_session_at: "2026-04-02T17:00:00.000Z",
      artifacts: [],
    },
  ],
};

const noHarness: SetupView = {
  harnesses: [
    {
      id: "claude_code",
      display_name: "Claude Code",
      detected: false,
      last_scan_at: null,
      project_count: 0,
      session_count: 0,
    },
  ],
  global: [],
  projects: [],
};

/**
 * The setup inventory: everything Claude Code loads, globally and per project,
 * annotated with whether anything ever used it. Storybook feeds the screen a
 * fixture through the `data` prop — in the app the data comes from `useSetup`.
 */
const meta = {
  title: "Screens/Setup",
  component: Setup,
  args: { navigate: () => {}, data: populated },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div style={{ height: "100vh", background: "var(--bg)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Setup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A detected harness with a full global layer and two projects. */
export const Populated: Story = {};

/**
 * The "Never used" chip pinned on: what is installed but has never fired.
 * Projects with nothing in the slice drop out entirely, and the ones that stay
 * say how much of them the filter kept.
 */
export const FilteredToNeverUsed: Story = {
  args: { initialFilter: "never" },
};

/** Nothing installed — the only way forward is to name a folder. */
export const NoHarnessDetected: Story = {
  args: { data: noHarness },
};
