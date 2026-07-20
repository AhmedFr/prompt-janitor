import type { Meta, StoryObj } from "@storybook/react";
import { RadarChart } from "./RadarChart";
import type { DimensionScore } from "@/lib/ipc";

const sampleData: DimensionScore[] = [
  { dimension: "Consistency", score: 62 },
  { dimension: "Format", score: 48 },
  { dimension: "Clarity", score: 71 },
  { dimension: "Structure", score: 55 },
  { dimension: "Examples", score: 40 },
];

const meta = {
  title: "Components/RadarChart",
  component: RadarChart,
  args: { data: sampleData, grade: "D" },
} satisfies Meta<typeof RadarChart>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
