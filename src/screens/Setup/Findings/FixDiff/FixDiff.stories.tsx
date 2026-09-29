import type { Meta, StoryObj } from "@storybook/react";
import { FixDiff } from "./FixDiff";

const meta = {
  title: "Screens/Setup/Findings/FixDiff",
  component: FixDiff,
  args: { from: "npm", to: "pnpm" },
} satisfies Meta<typeof FixDiff>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A check's deterministic fix: one phrase swapped for another. */
export const Replacement: Story = {};

/** A fix that only adds text: no removed line. */
export const Insertion: Story = {
  args: { from: "", to: "## Examples\n\n- Run `pnpm test` before every commit." },
};

/** A rewrite the AI provider suggested, with its note. */
export const AiRewrite: Story = {
  args: {
    from: "Always be careful with the database.",
    to: "Never run migrations against production; use the staging branch.",
    ai: true,
    note: "Replaced a vague caution with a concrete rule.",
  },
};
