import type { Meta, StoryObj } from "@storybook/react";
import { AiChecks } from "./AiChecks";

/** Storybook has no desktop runtime, so running the checks answers nothing; the idle panel is the one state it can show. */
const meta = {
  title: "Screens/Setup/Findings/AiChecks",
  component: AiChecks,
  args: { fileId: "story", content: "# CLAUDE.md", onApplied: () => {} },
} satisfies Meta<typeof AiChecks>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Before a run: the title, what it does, and Run AI checks. */
export const Idle: Story = {};
