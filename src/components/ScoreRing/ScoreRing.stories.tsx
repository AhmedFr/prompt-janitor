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

/** Every size the app draws: the panel's 56, the project header's 78, the hero's 120. */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
      <ScoreRing score={86} grade="B" size={56} />
      <ScoreRing score={86} grade="B" size={78} />
      <ScoreRing score={86} grade="B" size={120} />
    </div>
  ),
};

export const Range: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 16 }}>
      <ScoreRing score={94} grade="A" size={90} />
      <ScoreRing score={68} grade="C" size={90} />
      <ScoreRing score={38} grade="F" size={90} />
    </div>
  ),
};
