import type { Meta, StoryObj } from "@storybook/react";
import { Card } from "./Card";

const meta = {
  title: "Components/Card",
  component: Card,
  args: { padded: true },
  render: (args) => (
    <Card {...args} style={{ width: 280 }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>api-worker / CLAUDE.md</div>
      <div className="muted" style={{ fontSize: 12 }}>5 issues · last scanned 12 min ago</div>
    </Card>
  ),
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
