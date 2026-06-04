import type { Meta, StoryObj } from "@storybook/react";
import { Sparkline } from "./Sparkline";

const meta = {
  title: "Components/Sparkline",
  component: Sparkline,
  args: { data: [50, 54, 52, 61, 58, 70, 74] },
  render: (args) => (
    <div style={{ width: 220 }}>
      <Sparkline {...args} />
    </div>
  ),
} satisfies Meta<typeof Sparkline>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Declining: Story = { args: { data: [80, 76, 74, 60, 58, 50, 44], color: "var(--red)" } };
