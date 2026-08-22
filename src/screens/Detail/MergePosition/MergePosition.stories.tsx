import type { Meta, StoryObj } from "@storybook/react";
import type { ArtifactView, EffectiveRule } from "@/lib/ipc";
import { MergePosition } from "./MergePosition";
import type { MergePositionData } from "./MergePosition.types";

const now = new Date("2026-08-21T12:00:00Z");

const rule = (o: Partial<EffectiveRule> = {}): EffectiveRule => ({
  layer: "global",
  path: "/Users/ada/.claude/CLAUDE.md",
  name: "global CLAUDE.md",
  grade: "B",
  file_id: "f-global",
  ...o,
});

const artifact = (o: Partial<ArtifactView> = {}): ArtifactView => ({
  id: 1,
  harness: "claude_code",
  layer: "global",
  kind: "skill",
  name: "adapt",
  path: "/Users/ada/.claude/skills/adapt/SKILL.md",
  plugin_name: null,
  description: null,
  bytes: 1420,
  grade: "A",
  score: 92,
  file_id: null,
  usage: {
    total: 42,
    sessions: 12,
    last_used: "2026-08-18T12:00:00.000Z",
    error_rate: 0,
    avg_turn_tokens: null,
    count_30d: 5,
    count_prev_30d: 3,
  },
  ...o,
});

/** A plugin's own rules: they ship with the plugin, so they load everywhere. */
const pluginRung = rule({
  layer: "plugin",
  path: "/Users/ada/.claude/plugins/posthog/CLAUDE.md",
  name: "posthog plugin",
  grade: null,
  file_id: null,
});

const projectStack: MergePositionData = {
  layer: "project",
  project: { name: "prompt-janitor", path: "/Users/ada/code/prompt-janitor" },
  filePath: "/Users/ada/code/prompt-janitor/CLAUDE.md",
  effective: [
    rule(),
    rule({
      layer: "project",
      path: "/Users/ada/code/prompt-janitor/CLAUDE.md",
      name: "prompt-janitor CLAUDE.md",
      grade: "C",
      file_id: "f-repo",
    }),
  ],
  inStack: true,
  referenced: [
    artifact(),
    artifact({
      id: 2,
      kind: "command",
      name: "ship",
      path: "/Users/ada/code/prompt-janitor/.claude/commands/ship.md",
      usage: null,
    }),
    artifact({
      id: 3,
      kind: "mcp_server",
      name: "railway",
      path: "/Users/ada/.claude/mcp/railway.json",
      usage: {
        total: 31,
        sessions: 9,
        last_used: "2026-08-20T12:00:00.000Z",
        error_rate: 0.35,
        avg_turn_tokens: 4200,
        count_30d: 12,
        count_prev_30d: 4,
      },
    }),
  ],
};

const meta = {
  title: "Screens/Detail/MergePosition",
  component: MergePosition,
  args: { state: projectStack, now },
  decorators: [
    // The panel ships in Detail's 340px scorecard column; showing it any wider
    // would hide the wrapping the real layout forces on it.
    (Story) => (
      <div style={{ width: 340, background: "var(--win-bg)", padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MergePosition>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A project file: it loads last, on top of global and plugin rules. */
export const ProjectFile: Story = {};

/** A global rule file — the same panel, minus a project to belong to. */
export const GlobalFile: Story = {
  args: {
    state: {
      ...projectStack,
      layer: "global",
      project: null,
      filePath: "/Users/ada/.claude/CLAUDE.md",
      effective: [rule(), pluginRung],
    },
    now,
  },
};

/**
 * A rule file below a project root: it never joins the merged stack, so the
 * panel names the folder it does govern and labels the stack as the project's.
 */
export const BelowTheRoot: Story = {
  args: {
    state: {
      ...projectStack,
      filePath: "/Users/ada/code/prompt-janitor/src-tauri/CLAUDE.md",
      inStack: false,
    },
    now,
  },
};

/** A file no harness has ever indexed — there is no stack to place it in. */
export const UnknownFolder: Story = {
  args: {
    state: {
      ...projectStack,
      project: null,
      filePath: "/Users/ada/notes/CLAUDE.md",
      effective: [],
      inStack: false,
      referenced: [],
    },
    now,
  },
};

/** The project was found but its stack could not be read. */
export const StackUnreadable: Story = {
  args: {
    state: { ...projectStack, effective: "error", inStack: false },
    now,
  },
};

/** Nothing named, nothing stacked — both empty states say what is absent. */
export const NothingToShow: Story = {
  args: {
    state: { ...projectStack, effective: [], inStack: false, referenced: [] },
    now,
  },
};

/** The setup query failed; Detail's remaining sections carry on regardless. */
export const SetupUnavailable: Story = { args: { state: "error", now } };
