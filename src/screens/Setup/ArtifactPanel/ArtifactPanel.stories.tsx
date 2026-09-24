import type { Meta, StoryObj } from "@storybook/react";
import type { ArtifactView } from "@/lib/ipc";
import type { ArtifactSourceState } from "../Setup.types";
import { ArtifactPanelView } from "./index";

const server: ArtifactView = {
  id: 11,
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

const MCP_JSON = JSON.stringify(
  { command: "npx", args: ["-y", "@posthog/mcp-server"], env: { POSTHOG_API_KEY: "••••••" } },
  null,
  2,
);

/** A settled, read-only source — overridden per story. */
const source = (over: Partial<ArtifactSourceState> = {}): ArtifactSourceState => ({
  content: MCP_JSON,
  path: server.path,
  format: "json",
  editable: false,
  modified: "1",
  loading: false,
  saving: false,
  error: null,
  save: async () => null,
  ...over,
});

const meta = {
  title: "Screens/Setup/ArtifactPanel",
  component: ArtifactPanelView,
  parameters: { layout: "fullscreen" },
  args: { artifact: server, scope: "Global", source: source(), onClose: () => {} },
} satisfies Meta<typeof ArtifactPanelView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An MCP server: its config excerpt, env values masked. */
export const McpServer: Story = {};

/** An agent: markdown, frontmatter as a strip. */
export const Agent: Story = {
  args: {
    artifact: {
      ...server,
      kind: "agent",
      name: "code-reviewer",
      description: "Reviews a diff before a PR opens",
      path: "/Users/a/.claude/agents/code-reviewer.md",
    },
    scope: "web-app",
    source: source({
      format: "markdown",
      path: "/Users/a/.claude/agents/code-reviewer.md",
      content: "---\nname: code-reviewer\nmodel: sonnet\n---\n# Code reviewer\n\nRead the diff **twice**.",
    }),
  },
};

/** A hook: its event, matcher and command. */
export const Hook: Story = {
  args: {
    artifact: { ...server, kind: "hook", name: "PreToolUse: pnpm lint", usage: null },
    source: source({
      path: "/Users/a/.claude/settings.json",
      content: JSON.stringify(
        { event: "PreToolUse", matcher: "Edit", hook: { type: "command", command: "pnpm lint" } },
        null,
        2,
      ),
    }),
  },
};

export const Loading: Story = {
  args: { source: source({ content: null, format: null, loading: true }) },
};

export const ReadFailed: Story = {
  args: {
    source: source({ content: null, format: null, error: "That entry is no longer in .claude.json." }),
  },
};

/** A file with nothing in it. */
export const EmptyFile: Story = {
  args: { source: source({ content: "", format: "text" }) },
};
