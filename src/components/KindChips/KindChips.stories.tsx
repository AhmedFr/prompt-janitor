import type { Meta, StoryObj } from "@storybook/react";
import { KindChips } from "./KindChips";

const meta = {
  title: "Components/KindChips",
  component: KindChips,
  parameters: {
    layout: "padded",
  },
} satisfies Meta<typeof KindChips>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllSelected: Story = {
  args: {
    counts: { all: 12, rule: 3, skill: 9, agent: 2, command: 4, mcp_server: 0, hook: 1, plugin: 0, settings: 2 },
    active: "all",
    onChange: () => {},
  },
};

export const OneKind: Story = {
  args: {
    counts: { all: 12, rule: 3, skill: 9, agent: 2, command: 4, mcp_server: 0, hook: 1, plugin: 0, settings: 2 },
    active: "skill",
    onChange: () => {},
  },
};

export const EmptyKinds: Story = {
  args: {
    counts: {},
    active: "all",
    onChange: () => {},
  },
};
