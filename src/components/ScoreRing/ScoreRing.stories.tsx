import type { Meta, StoryObj } from "@storybook/react";
import { ScoreRing } from "./ScoreRing";

const meta = {
  title: "Components/ScoreRing",
  component: ScoreRing,
  args: { score: 52, grade: "D", size: 120 },
} satisfies Meta<typeof ScoreRing>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Range: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 16 }}>
      <ScoreRing score={94} grade="A" size={90} />
      <ScoreRing score={68} grade="C" size={90} />
      <ScoreRing score={38} grade="F" size={90} />
    </div>
  ),
};
