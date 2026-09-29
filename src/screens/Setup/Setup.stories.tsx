import type { Meta, StoryObj } from "@storybook/react";
import { Setup } from "./Setup";
import type { ArtifactView, FileRow, SetupView, UsageStat } from "@/lib/ipc";
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
  issue_count: null,
  worst_severity: null,
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
      bytes: 4096,
      usage: usage({ total: 177, sessions: 177, avg_turn_tokens: 1100 }),
    }),
    artifact({
      id: 2,
      kind: "skill",
      name: "systematic-debugging",
      description: "Structured root-cause workflow before proposing a fix.",
      path: "/home/u/.claude/skills/systematic-debugging/SKILL.md",
      usage: usage({ total: 31, sessions: 14, avg_turn_tokens: 1400 }),
    }),
    artifact({
      id: 3,
      kind: "skill",
      name: "writing-plans",
      description: "Turns a spec into a step-by-step implementation plan.",
      path: "/home/u/.claude/skills/writing-plans/SKILL.md",
      usage: null,
    }),
    artifact({
      id: 4,
      kind: "agent",
      name: "code-reviewer",
      description: "Reviews a diff against the project's conventions.",
      path: "/home/u/.claude/agents/code-reviewer.md",
      usage: usage({ total: 4, sessions: 3, avg_turn_tokens: 6200 }),
    }),
    artifact({
      id: 5,
      kind: "mcp_server",
      name: "linear",
      description: "Linear issue tracker integration.",
      path: "/home/u/.claude/mcp/linear",
      usage: usage({ total: 40, sessions: 12, error_rate: 0.42, avg_turn_tokens: 700 }),
    }),
    artifact({
      id: 6,
      kind: "hook",
      name: "PreToolUse: pnpm format",
      path: "/home/u/.claude/settings.json",
      usage: null,
    }),
    artifact({
      id: 7,
      kind: "plugin",
      layer: "plugin",
      name: "superpowers",
      plugin_name: "superpowers",
      description: "v6.3.0 · claude-plugins-official",
      path: "/home/u/.claude/plugins/superpowers",
    }),
    artifact({
      id: 8,
      kind: "skill",
      layer: "plugin",
      name: "brainstorming",
      plugin_name: "superpowers",
      description: "Explores intent and requirements before implementation.",
      path: "/home/u/.claude/plugins/superpowers/skills/brainstorming/SKILL.md",
      usage: usage({ total: 12, sessions: 7, avg_turn_tokens: 2400 }),
    }),
    artifact({
      id: 9,
      kind: "command",
      layer: "plugin",
      name: "review",
      plugin_name: "superpowers",
      description: "Runs the review checklist over a branch.",
      path: "/home/u/.claude/plugins/superpowers/commands/review.md",
      usage: null,
    }),
    artifact({
      id: 15,
      kind: "plugin",
      layer: "plugin",
      name: "posthog",
      plugin_name: "posthog",
      description: "v2.1.0 · posthog-marketplace",
      path: "/home/u/.claude/plugins/posthog",
    }),
    // Same name as superpowers' skill: the Scope column is the only thing
    // that says which install each row came from.
    artifact({
      id: 16,
      kind: "skill",
      layer: "plugin",
      name: "brainstorming",
      plugin_name: "posthog",
      description: "Session-replay-flavoured product brainstorm.",
      path: "/home/u/.claude/plugins/posthog/skills/brainstorming/SKILL.md",
      usage: null,
    }),
    artifact({
      id: 17,
      kind: "settings",
      name: "settings.json",
      description: "Permissions, hooks and MCP wiring.",
      path: "/home/u/.claude/settings.json",
      bytes: 3072,
    }),
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
          id: 10,
          layer: "project",
          kind: "rule",
          name: "CLAUDE.md",
          description: "Project instructions: status dashboard, ship process.",
          path: "/Users/dev/code/prompt-janitor/CLAUDE.md",
          grade: "A",
          score: 94,
          file_id: "f-pj",
          bytes: 2560,
          usage: usage({ total: 96, sessions: 96, avg_turn_tokens: 1200 }),
        }),
        artifact({
          id: 11,
          layer: "project",
          kind: "command",
          name: "ship",
          description: "Branch, PR and status-dashboard update in one go.",
          path: "/Users/dev/code/prompt-janitor/.claude/commands/ship.md",
          usage: usage({ total: 11, sessions: 8, avg_turn_tokens: 3000 }),
        }),
        artifact({
          id: 12,
          layer: "project",
          kind: "agent",
          name: "release-notes",
          description: "Drafts the changelog entry for a merged PR.",
          path: "/Users/dev/code/prompt-janitor/.claude/agents/release-notes.md",
          usage: null,
        }),
        artifact({
          id: 13,
          layer: "project",
          kind: "skill",
          name: "shipping-a-feature",
          description: "The issue → branch → TDD → PR checklist.",
          path: "/Users/dev/code/prompt-janitor/.claude/skills/shipping-a-feature/SKILL.md",
          usage: usage({ total: 52, sessions: 30, avg_turn_tokens: 1800 }),
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
      artifacts: [
        artifact({
          id: 14,
          layer: "project",
          kind: "skill",
          name: "scrape-docs",
          description: "One-off scraper for the vendor's docs site.",
          path: "/Users/dev/code/old-experiment/.claude/skills/scrape-docs/SKILL.md",
          usage: null,
        }),
      ],
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

/** Graded files no inventory row points at — an extra scan folder's instruction files. */
const gradedOnly: FileRow[] = [
  {
    id: "/code/side-project/AGENTS.md",
    name: "AGENTS.md",
    path: "/code/side-project/AGENTS.md",
    project: "side-project",
    project_id: "/code/side-project",
    kind: "AGENTS.md",
    grade: "D",
    score: 58,
    issue_count: 4,
    modified: null,
    worst_severity: "hi",
  },
  {
    id: "/code/side-project/.cursorrules",
    name: ".cursorrules",
    path: "/code/side-project/.cursorrules",
    project: "side-project",
    project_id: "/code/side-project",
    kind: ".cursorrules",
    grade: "B",
    score: 84,
    issue_count: 1,
    modified: null,
    worst_severity: "lo",
  },
];

/**
 * The table remembers its search, pills and sort in `sessionStorage`, which
 * outlives a story swap — so every story starts from a clean slate. Run
 * during the decorator's render, before the table below it mounts and reads.
 */
const clearState = () => {
  for (const key of Object.keys(window.sessionStorage)) {
    if (key.startsWith("pj.table.")) window.sessionStorage.removeItem(key);
  }
};

/**
 * The Setup home: one table over every kind, narrowed by the kind chips and
 * the summary line's filters. Storybook feeds the screen a fixture through
 * `data` and `files` — in the app they come from `useSetup`.
 */
const meta = {
  title: "Screens/Setup",
  component: Setup,
  args: { navigate: () => {}, data: populated, files: [] },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => {
      clearState();
      return (
        <div style={{ height: "100vh", background: "var(--bg)" }}>
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<typeof Setup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The All chip: every kind in one table, Kind then Name, with the Kind column. */
export const AllItems: Story = {};

/** One kind (Skills): the Kind column drops away and the usage columns stay. */
export const OneKind: Story = {
  args: { target: { kind: "skill" } },
};

/**
 * "never used" pressed on the summary line: what is installed but has never
 * fired, across every kind the usage index counts.
 */
export const NeverUsedFilter: Story = {
  args: { target: { filter: "never" } },
};

/** Graded files the inventory never saw join as Instructions, with their findings. */
export const WithGradedOnlyFiles: Story = {
  args: { files: gradedOnly, target: { kind: "rule" } },
};

/**
 * A deep link that opens an item on a tab: the viewer over the table. Outside
 * the desktop app the file itself cannot be read, so Content says so.
 */
export const ItemOpen: Story = {
  args: { target: { kind: "skill", open: { artifactId: 2 }, tab: "usage" } },
};

/** Nothing installed — the only way forward is to add a folder. */
export const NoHarness: Story = {
  args: { data: noHarness },
};

/** The inventory query failed: say so, and offer the retry. */
export const Unreadable: Story = {
  args: { data: null },
};
