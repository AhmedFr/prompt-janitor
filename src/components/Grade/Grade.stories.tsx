import type { Meta, StoryObj } from "@storybook/react";
import { Grade } from "./Grade";

const meta = {
  title: "Components/Grade",
  component: Grade,
  args: { grade: "A", size: "md" },
  argTypes: {
    grade: { control: "select", options: ["A", "B", "C", "D", "F"] },
    size: { control: "inline-radio", options: ["sm", "md", "lg", "xl"] },
  },
} satisfies Meta<typeof Grade>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllGrades: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 10 }}>
      {(["A", "B", "C", "D", "F"] as const).map((g) => (
        <Grade key={g} grade={g} />
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Grade grade="B" size="sm" />
      <Grade grade="B" size="md" />
      <Grade grade="B" size="lg" />
      <Grade grade="B" size="xl" />
    </div>
  ),
};

export const Ghost: Story = { args: { grade: "A", ghost: true, size: "lg" } };
