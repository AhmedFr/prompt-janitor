import type { Meta, StoryObj } from "@storybook/react";
import type { ArtifactView } from "@/lib/ipc";
import { ArtifactFacts } from "./index";

const base: ArtifactView = {
  id: 1,
  harness: "claude_code",
  layer: "global",
  kind: "mcp_server",
  name: "posthog",
  path: "/Users/a/.claude.json",
  plugin_name: null,
  description: null,
  bytes: 120,
  grade: null,
  score: null,
  file_id: null,
  usage: null,
};

const meta = {
  title: "Screens/Setup/ArtifactFacts",
  component: ArtifactFacts,
  parameters: { layout: "padded" },
  args: { artifact: base, scope: "Global" },
} satisfies Meta<typeof ArtifactFacts>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Never invoked: kind, scope and "never". */
export const NeverUsed: Story = {};

/** An MCP server with a full usage record. */
export const WithUsage: Story = {
  args: {
    artifact: {
      ...base,
      usage: {
        total: 1234,
        sessions: 41,
        last_used: new Date(Date.now() - 3 * 86_400_000).toISOString(),
        error_rate: 0.083,
        avg_turn_tokens: 5400,
        count_30d: 200,
        count_prev_30d: 150,
      },
    },
  },
};

/** An agent with a description. */
export const WithDescription: Story = {
  args: {
    artifact: { ...base, kind: "agent", name: "code-reviewer", description: "Reviews a diff before a PR opens" },
    scope: "web-app",
  },
};

/** A graded rule. */
export const Graded: Story = {
  args: { artifact: { ...base, kind: "rule", name: "CLAUDE.md", grade: "B", score: 78 } },
};
