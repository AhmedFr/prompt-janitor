import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./Button";
import { Icon } from "@/components/Icon";

const meta = {
  title: "Components/Button",
  component: Button,
  args: { children: "Scan now", variant: "default", size: "md" },
  argTypes: {
    variant: { control: "inline-radio", options: ["default", "primary"] },
    size: { control: "inline-radio", options: ["md", "sm", "icon"] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Primary: Story = { args: { variant: "primary", children: "Apply fix" } };

export const Variants: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <Button>Default</Button>
      <Button variant="primary">Primary</Button>
      <Button size="sm">Small</Button>
      <Button variant="primary" size="sm">
        <Icon name="wand" /> Auto-fix
      </Button>
      <Button size="icon" aria-label="Refresh">
        <Icon name="refresh" />
      </Button>
    </div>
  ),
};
