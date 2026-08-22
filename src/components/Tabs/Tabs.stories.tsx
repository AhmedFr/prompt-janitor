import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Tabs } from "./Tabs";
import type { TabItem } from "./Tabs.types";

const ITEMS: TabItem[] = [
  { id: "rules", label: "Rules", count: 42 },
  { id: "skills", label: "Skills", count: 8 },
  { id: "agents", label: "Agents", count: 3 },
  { id: "commands", label: "Commands", count: 15 },
  { id: "hooks", label: "Hooks", count: 0 },
  { id: "mcp", label: "MCP", count: 2 },
  { id: "plugins", label: "Plugins" },
];

/** `Tabs` is controlled; every story wraps it in a stateful shell. */
function Demo({ items, initial }: { items: TabItem[]; initial: string }) {
  const [active, setActive] = useState(initial);
  return (
    <Tabs items={items} active={active} onChange={setActive} ariaLabel="Setup">
      {(id) => <p style={{ margin: 0, padding: "16px 4px" }}>Table for “{id}” renders here.</p>}
    </Tabs>
  );
}

const meta: Meta<typeof Demo> = {
  title: "Components/Tabs",
  component: Demo,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Demo>;

export const WithCounts: Story = { args: { items: ITEMS, initial: "rules" } };

export const Few: Story = {
  args: { items: [{ id: "built-in", label: "Built-in", count: 20 }, { id: "custom", label: "Custom", count: 4 }, { id: "standards", label: "AI standards", count: 6 }], initial: "built-in" },
};
