import type { Meta, StoryObj } from "@storybook/react";
import type { TemplateInfo } from "@/lib/ipc";
import { TemplatePicker } from "./TemplatePicker";

const templates: TemplateInfo[] = [
  {
    id: "react-ts-claude",
    stack: "react-ts",
    file_type: "CLAUDE.md",
    title: "React + TypeScript — CLAUDE.md",
    description: "Role, pnpm commands, output format, and a worked example.",
    preview:
      "# CLAUDE.md — React + TypeScript (pnpm)\n\n## Role\nYou are a senior React and TypeScript engineer working directly in this codebase.\n\n## Stack facts\n- Package manager: pnpm\n- Run tests: `pnpm test`\n",
  },
  {
    id: "react-ts-agents",
    stack: "react-ts",
    file_type: "AGENTS.md",
    title: "React + TypeScript — AGENTS.md",
    description: "Setup, build/test commands, and verification steps.",
    preview: "# AGENTS.md — React + TypeScript (pnpm)\n\nYou are an autonomous coding agent...\n",
  },
  {
    id: "python-claude",
    stack: "python",
    file_type: "CLAUDE.md",
    title: "Python — CLAUDE.md",
    description: "Role, uv/pytest commands, output format, and a worked example.",
    preview: "# CLAUDE.md — Python (uv + pytest)\n\n## Role\nYou are a senior Python engineer...\n",
  },
  {
    id: "python-agents",
    stack: "python",
    file_type: "AGENTS.md",
    title: "Python — AGENTS.md",
    description: "Setup, test/lint commands, and verification steps.",
    preview: "# AGENTS.md — Python (uv + pytest)\n\nYou are an autonomous coding agent...\n",
  },
  {
    id: "rust-claude",
    stack: "rust",
    file_type: "CLAUDE.md",
    title: "Rust — CLAUDE.md",
    description: "Role, cargo commands, output format, and a worked example.",
    preview: "# CLAUDE.md — Rust (cargo)\n\n## Role\nYou are a senior Rust engineer...\n",
  },
  {
    id: "rust-agents",
    stack: "rust",
    file_type: "AGENTS.md",
    title: "Rust — AGENTS.md",
    description: "Setup, build/test commands, and verification steps.",
    preview: "# AGENTS.md — Rust (cargo)\n\nYou are an autonomous coding agent...\n",
  },
];

const meta = {
  title: "Components/TemplatePicker",
  component: TemplatePicker,
  args: {
    templates,
    entitled: false,
    loading: false,
    onApply: async () => ({ status: "cancelled" }) as const,
    onClose: () => {},
    navigate: () => {},
  },
} satisfies Meta<typeof TemplatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Free tier: every template is fully readable, but applying it opens checkout. */
export const Locked: Story = {};

/** Paid tier: "Use this template" writes the file straight away. */
export const Entitled: Story = {
  args: { entitled: true },
};

/** Still fetching the catalog + entitlement. */
export const Loading: Story = {
  args: { templates: [], loading: true },
};
