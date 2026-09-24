import type { Meta, StoryObj } from "@storybook/react";
import type { ArtifactView } from "@/lib/ipc";
import { ArtifactMeta } from "./index";

const agent: ArtifactView = {
  id: 1,
  harness: "claude_code",
  layer: "project",
  kind: "agent",
  name: "code-reviewer",
  path: "/Users/a/web-app/.claude/agents/code-reviewer.md",
  plugin_name: null,
  description: "Reviews a diff against the plan before a PR opens, and names the file and line of every finding",
  bytes: 1200,
  grade: null,
  score: null,
  file_id: null,
  usage: {
    total: 312,
    sessions: 18,
    last_used: new Date(Date.now() - 2 * 3_600_000).toISOString(),
    error_rate: 0.04,
    avg_turn_tokens: 7300,
    count_30d: 120,
    count_prev_30d: 80,
  },
};

const meta = {
  title: "Screens/Setup/ArtifactMeta",
  component: ArtifactMeta,
  parameters: { layout: "padded" },
  args: { artifact: agent, scope: "web-app" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ArtifactMeta>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Healthy: a green rate. */
export const Healthy: Story = {};

/** Worth a look: amber. */
export const Watch: Story = {
  args: { artifact: { ...agent, usage: agent.usage ? { ...agent.usage, error_rate: 0.14 } : null } },
};

/** Failing: red, heavier, with an icon. */
export const Failing: Story = {
  args: { artifact: { ...agent, usage: agent.usage ? { ...agent.usage, error_rate: 0.31 } : null } },
};

/** Never invoked. */
export const NeverUsed: Story = { args: { artifact: { ...agent, kind: "skill", usage: null } } };

/** A kind nothing invokes: just what and where. */
export const Settings: Story = {
  args: { artifact: { ...agent, kind: "settings", name: "settings.json", description: null, usage: null }, scope: "Global" },
};
