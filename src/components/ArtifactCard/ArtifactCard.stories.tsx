import type { Meta, StoryObj } from "@storybook/react";
import { ArtifactCard } from "./ArtifactCard";
import type { ArtifactView } from "@/lib/ipc";

const artifact = (o: Partial<ArtifactView>): ArtifactView => ({
  id: 1,
  harness: "claude-code",
  layer: "project",
  kind: "rule",
  name: "no-console-log",
  path: "/repo/.claude/rules/no-console-log.md",
  plugin_name: null,
  description: "Flags leftover console.log statements.",
  bytes: 512,
  grade: null,
  score: null,
  file_id: null,
  usage: null,
  ...o,
});

const meta = {
  title: "Components/ArtifactCard",
  component: ArtifactCard,
  args: { artifact: artifact({}) },
} satisfies Meta<typeof ArtifactCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rule: Story = {
  args: {
    artifact: artifact({
      kind: "rule",
      name: "no-console-log",
      description: "Flags leftover console.log statements.",
      grade: "B",
      score: 82,
      file_id: "file-123",
      usage: {
        total: 42,
        sessions: 12,
        last_used: "2026-08-18T12:00:00.000Z",
        error_rate: 0,
        avg_turn_tokens: null,
        count_30d: 5,
        count_prev_30d: 3,
      },
    }),
  },
};

export const Skill: Story = {
  args: {
    artifact: artifact({
      kind: "skill",
      name: "systematic-debugging",
      description: "Structured root-cause workflow before proposing a fix.",
      usage: {
        total: 7,
        sessions: 5,
        last_used: "2026-08-20T10:00:00.000Z",
        error_rate: 0,
        avg_turn_tokens: 1200,
        count_30d: 5,
        count_prev_30d: 2,
      },
    }),
  },
};

export const McpServerErrorProne: Story = {
  args: {
    artifact: artifact({
      kind: "mcp_server",
      name: "linear",
      description: "Linear issue tracker integration.",
      usage: {
        total: 30,
        sessions: 10,
        last_used: "2026-08-19T08:00:00.000Z",
        error_rate: 0.4,
        avg_turn_tokens: null,
        count_30d: 10,
        count_prev_30d: 20,
      },
    }),
  },
};

export const PluginNeverUsed: Story = {
  args: {
    artifact: artifact({
      kind: "plugin",
      layer: "plugin",
      name: "linear-mcp",
      plugin_name: "linear-mcp",
      description: "Bundles the Linear MCP server and its slash commands.",
      usage: null,
    }),
  },
};
