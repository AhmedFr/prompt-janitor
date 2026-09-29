import type { Meta, StoryObj } from "@storybook/react";
import { GradePopover } from "./GradePopover";

const trend = [
  { t: "1790000000", score: 66 },
  { t: "1790086400", score: 70 },
  { t: "1790172800", score: 74 },
];

const meta = {
  title: "Components/GradePopover",
  component: GradePopover,
  parameters: { layout: "padded" },
  args: { grade: "C", onFix: async () => ({ files: 2, edits: 5, failed: 0 }) },
} satisfies Meta<typeof GradePopover>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = { args: { state: { trend, openFindings: 12, fixable: 5, loading: false } } };
export const Open: Story = {
  args: { state: { trend, openFindings: 12, fixable: 5, loading: false } },
  play: async ({ canvasElement }) => {
    canvasElement.querySelector<HTMLButtonElement>(".grade-popover__trigger")?.click();
  },
};
export const NothingFixable: Story = {
  ...Open,
  args: { state: { trend, openFindings: 3, fixable: 0, loading: false } },
};
export const Loading: Story = {
  ...Open,
  args: { state: { trend: [], openFindings: 0, fixable: 0, loading: true } },
};
