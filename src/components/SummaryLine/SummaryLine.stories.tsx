import type { Meta, StoryObj } from "@storybook/react";
import { SummaryLine } from "./SummaryLine";

const meta = {
  title: "Components/SummaryLine",
  component: SummaryLine,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof SummaryLine>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithFilters: Story = {
  args: {
    grade: "C",
    items: 84,
    counts: { never: 3, errors: 1, cost: 2 },
    active: "all",
    onFilter: () => {},
  },
};

export const FilterActive: Story = {
  args: {
    grade: "C",
    items: 84,
    counts: { never: 3, errors: 1, cost: 2 },
    active: "errors",
    onFilter: () => {},
  },
};

export const NoScanYet: Story = {
  args: {
    grade: null,
    items: 0,
    counts: { never: 0, errors: 0, cost: 0 },
    active: "all",
    onFilter: () => {},
  },
};
