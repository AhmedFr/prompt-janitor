import type { Meta, StoryObj } from "@storybook/react";
import { FileViewer } from "./index";

const SKILL = [
  "---",
  "name: code-reviewer",
  "description: Reviews a diff against the plan before a PR opens",
  "model: sonnet",
  "---",
  "# Code reviewer",
  "",
  "Read the diff **once** for intent, then again for *defects*.",
  "",
  "## Checklist",
  "",
  "- Flag anything the plan did not ask for",
  "- Name the file and line for every finding",
  "- Run `pnpm check` before approving",
  "",
  "```bash",
  "git diff main...HEAD --stat",
  "```",
].join("\n");

const meta = {
  title: "Components/FileViewer",
  component: FileViewer,
  parameters: { layout: "fullscreen" },
  args: {
    name: "code-reviewer",
    content: SKILL,
    format: "markdown",
    path: "/Users/a/.claude/agents/code-reviewer.md",
    loading: false,
    error: null,
    onRetry: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: "var(--card)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FileViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Markdown opens rendered, with the frontmatter as a strip. */
export const Rendered: Story = {};

/** The same file as written: numbered, coloured, frontmatter included. */
export const Source: Story = { args: { initialMode: "source" } };

/** A JSON excerpt has only its source; the bar names the language instead of a toggle. */
export const Json: Story = {
  args: {
    name: "posthog",
    format: "json",
    path: "/Users/a/.claude.json",
    content: JSON.stringify({ command: "npx", args: ["-y", "@posthog/mcp-server"], env: { POSTHOG_API_KEY: "••••••" } }, null, 2),
  },
};

export const Loading: Story = { args: { content: null, format: null, loading: true } };

export const ReadFailed: Story = {
  args: { content: null, format: null, error: "Command get_artifact_source not allowed by ACL" },
};

export const EmptyFile: Story = { args: { content: "", format: "text", path: "/a/empty.txt" } };

/** The skill editor in the body; the toggle and find step aside. */
export const Editing: Story = {
  args: {
    editor: <textarea className="sp__editor" aria-label="Skill markdown" defaultValue={SKILL} />,
  },
};
