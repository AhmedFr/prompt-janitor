import type { Meta, StoryObj } from "@storybook/react";
import { Heatmap } from "./Heatmap";
import type { FileRow } from "@/lib/ipc";

const grades = ["A", "B", "C", "D", "F"] as const;

const files: FileRow[] = Array.from({ length: 24 }, (_, i) => ({
  id: `f${i}`,
  name: `f${i}`,
  path: `f${i}`,
  project: "p",
  project_id: "/p",
  kind: "CLAUDE.md",
  grade: grades[i % 5],
  score: 100 - i * 3,
  issue_count: 0,
  modified: "1",
}));

const meta = {
  title: "Components/Heatmap",
  component: Heatmap,
  args: { files },
} satisfies Meta<typeof Heatmap>;

export default meta;

export const Default: StoryObj<typeof meta> = {};
