import type { Meta, StoryObj } from "@storybook/react";
import { CodeView } from "./index";

const meta = {
  title: "Components/CodeView",
  component: CodeView,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 760, background: "var(--card)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CodeView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A skill file: frontmatter, headings, a list, a fenced block. */
export const Markdown: Story = {
  args: {
    language: "markdown",
    ariaLabel: "SKILL.md source",
    content: [
      "---",
      "name: code-reviewer",
      "description: Reviews a diff against the plan before a PR opens",
      "model: sonnet",
      "---",
      "# Code reviewer",
      "",
      "Read the diff **once** for intent, then again for *defects*.",
      "",
      "- Flag anything the plan did not ask for",
      "- Name the file and line for every finding",
      "",
      "```bash",
      "git diff main...HEAD --stat",
      "```",
    ].join("\n"),
  },
};

/** An MCP server entry, as the redacted excerpt the backend hands over. */
export const Json: Story = {
  args: {
    language: "json",
    ariaLabel: ".claude.json excerpt",
    content: JSON.stringify(
      { command: "npx", args: ["-y", "@posthog/mcp-server"], env: { POSTHOG_API_KEY: "••••••" }, disabled: false, timeout: 30 },
      null,
      2,
    ),
  },
};

export const Toml: Story = {
  args: {
    language: "toml",
    ariaLabel: "config.toml source",
    content: ['[server]', 'name = "posthog"', "port = 8080", "enabled = true", "", "# Keep secrets in the keychain", '[env]', 'REGION = "eu"'].join("\n"),
  },
};

export const Yaml: Story = {
  args: {
    language: "yaml",
    ariaLabel: "rules.yml source",
    content: ["rules:", "  - id: no-todo", "    severity: warn  # soft", "    pattern: 'TODO'", "  - id: max-lines", "    limit: 400"].join("\n"),
  },
};

export const Shell: Story = {
  args: {
    language: "shell",
    ariaLabel: "hook.sh source",
    content: ['#!/usr/bin/env bash', 'set -euo pipefail', '# Format before every commit', 'if [ -n "$(git diff --cached --name-only)" ]; then', '  pnpm -s lint --fix', "fi"].join("\n"),
  },
};

/** A long line wraps inside its row; the number stays at the top of it. */
export const LongLines: Story = {
  args: {
    language: "json",
    ariaLabel: "settings.json source",
    content: JSON.stringify(
      {
        permissions: {
          allow: [
            "Bash(pnpm check:*)",
            "Bash(git status:*)",
            "mcp__claude-in-chrome__computer, mcp__claude-in-chrome__navigate, mcp__claude-in-chrome__read_page, mcp__claude-in-chrome__tabs_create_mcp",
          ],
        },
      },
      null,
      2,
    ),
  },
};

/** Plain text: no grammar, still numbered. */
export const PlainText: Story = {
  args: { language: null, ariaLabel: "LICENSE", content: "MIT License\n\nCopyright (c) 2026\n\nPermission is hereby granted…" },
};

/** 5,000 lines — rows off screen skip layout, so this scrolls like a short file. */
export const FiveThousandLines: Story = {
  args: {
    language: "yaml",
    ariaLabel: "big.yml source",
    content: Array.from({ length: 5000 }, (_, i) => `key_${i}: "value ${i}"  # line ${i + 1}`).join("\n"),
  },
};
