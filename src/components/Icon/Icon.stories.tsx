import type { Meta, StoryObj } from "@storybook/react";
import { Icon } from "./Icon";
import type { IconName } from "./Icon.types";

const ALL: IconName[] = [
  "logo", "dashboard", "prompts", "scans", "rules", "settings", "search", "plus",
  "refresh", "chevronRight", "chevronDown", "sparkles", "folder", "bell", "clock",
  "check", "x", "arrowUp", "arrowDown", "wand",
];

const meta = {
  title: "Components/Icon",
  component: Icon,
  args: { name: "logo", size: 24 },
  argTypes: { name: { control: "select", options: ALL } },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {};

export const Gallery: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 18, color: "var(--blue)" }}>
      {ALL.map((name) => (
        <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <Icon name={name} size={22} />
          <span style={{ fontSize: 10, color: "var(--text-3)" }}>{name}</span>
        </div>
      ))}
    </div>
  ),
};
