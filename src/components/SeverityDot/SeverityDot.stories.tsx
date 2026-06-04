import type { Meta, StoryObj } from "@storybook/react";
import { SeverityDot } from "./SeverityDot";

const meta = {
  title: "Components/SeverityDot",
  component: SeverityDot,
  args: { level: "hi" },
  argTypes: { level: { control: "inline-radio", options: ["hi", "mid", "lo"] } },
} satisfies Meta<typeof SeverityDot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllLevels: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
      <SeverityDot level="hi" />
      <SeverityDot level="mid" />
      <SeverityDot level="lo" />
    </div>
  ),
};
