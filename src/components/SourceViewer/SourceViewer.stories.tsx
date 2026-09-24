import type { Meta, StoryObj } from "@storybook/react";
import { SourceViewer } from "./index";

const meta = {
  title: "Components/SourceViewer",
  component: SourceViewer,
  parameters: { layout: "padded" },
  // The sheet this renders in is narrow; a full-width story would flatter
  // the line lengths in a way the real screen never does.
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SourceViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** An agent file: frontmatter strip, then the rendered body. */
export const Markdown: Story = {
  args: {
    format: "markdown",
    content: [
      "---",
      "name: code-reviewer",
      "description: Reviews a diff against the plan before a PR opens",
      "model: sonnet",
      "---",
      "# Code reviewer",
      "",
      "Read the diff **once** for intent, then again for defects.",
      "",
      "- Flag anything the plan did not ask for",
      "- Name the file and line for every finding",
    ].join("\n"),
  },
};

/** An MCP server's config, secrets already masked by the backend. */
export const Json: Story = {
  args: {
    format: "json",
    content: JSON.stringify(
      {
        command: "npx",
        args: ["-y", "@posthog/mcp-server", "--region", "eu", "--project-id", "12345"],
        env: { POSTHOG_API_KEY: "••••••", POSTHOG_HOST: "••••••" },
      },
      null,
      2,
    ),
  },
};

/** Plain text keeps its line breaks and wraps long lines. */
export const Text: Story = {
  args: {
    format: "text",
    content:
      "A very long single line of plain text that would otherwise run off the edge of the sheet and hide its end.\nSecond line.",
  },
};

/** A markdown file whose header is all there is. */
export const HeaderOnly: Story = {
  args: { format: "markdown", content: "---\nname: stub\ndescription: not written yet\n---\n" },
};

/** Nothing but whitespace. */
export const Empty: Story = { args: { format: "text", content: "\n\n" } };
