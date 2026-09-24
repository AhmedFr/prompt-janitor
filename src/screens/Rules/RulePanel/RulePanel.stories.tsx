import type { Meta, StoryObj } from "@storybook/react";
import type { RuleInfo } from "@/lib/ipc";
import { RulePanel } from "./index";

const rule: RuleInfo = {
  id: "no-slack",
  title: "No Slack references",
  description: "Flags any prompt file that mentions Slack — the team moved off it, and stale channel names mislead the agent.",
  source: "custom",
  severity: "mid",
  enabled: true,
  custom: true,
  nl: false,
  pattern: "slack.com",
  hit_count: 3,
};

const meta = {
  title: "Screens/Rules/RulePanel",
  component: RulePanel,
  parameters: { layout: "fullscreen" },
  args: { rule, onClose: () => {} },
} satisfies Meta<typeof RulePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A user's pattern rule: its forbidden substring under the description. */
export const PatternRule: Story = {};

/** An AI standard: the instruction the provider judges against. */
export const AiStandard: Story = {
  args: {
    rule: {
      ...rule,
      id: "shape",
      title: "State the output shape",
      description: "Every prompt must say what its answer looks like.",
      nl: true,
      severity: "hi",
      pattern: "The prompt states the format, length and structure of the expected answer.",
      hit_count: 12,
    },
  },
};

/** A built-in rule, switched off, with no pattern to show. */
export const BuiltInDisabled: Story = {
  args: {
    rule: {
      ...rule,
      id: "terse",
      title: "Be terse",
      description: "Long preambles cost turns.",
      source: "anthropic",
      severity: "lo",
      enabled: false,
      custom: false,
      pattern: null,
      hit_count: 0,
    },
  },
};
