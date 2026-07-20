import type { Meta, StoryObj } from "@storybook/react";
import { SourceBadge } from "./SourceBadge";

const meta = {
  title: "Components/SourceBadge",
  component: SourceBadge,
  args: { source: "anthropic" },
  argTypes: {
    source: {
      control: "inline-radio",
      options: ["anthropic", "openai", "cursor", "karpathy", "custom"],
    },
  },
} satisfies Meta<typeof SourceBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllSources: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 8 }}>
      {(["anthropic", "openai", "cursor", "karpathy", "custom"] as const).map((s) => (
        <SourceBadge key={s} source={s} />
      ))}
    </div>
  ),
};
