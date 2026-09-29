import type { Meta, StoryObj } from "@storybook/react";
import type { SetupRow } from "../setupRows.util";
import { ItemUsage } from "./ItemUsage";

const skill = {
  id: 4, kind: "skill", name: "adapt", bytes: 900, origin: "inventory",
  usage: { total: 3, sessions: 2, last_used: "2026-09-26T09:00:00Z", error_rate: 0.33, avg_turn_tokens: 2000, count_30d: 3, count_prev_30d: 0 },
} as SetupRow;

const usage = {
  window_days: 30,
  per_day: [
    { day: "2026-09-24", uses: 0, errors: 0 },
    { day: "2026-09-25", uses: 2, errors: 1 },
    { day: "2026-09-26", uses: 1, errors: 0 },
  ],
  by_project: [
    { path: "/code/web", name: "web", uses: 2, sessions: 1 },
    { path: "/code/api", name: "api", uses: 1, sessions: 1 },
  ],
  avg_turn_tokens: 2000,
};

const meta = {
  title: "Screens/Setup/ItemUsage",
  component: ItemUsage,
  args: { item: skill, loadedIn: [], onSelectProject: () => {}, usage },
} satisfies Meta<typeof ItemUsage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Skill30Days: Story = {};
export const Skill90Days: Story = { args: { usage: { ...usage, window_days: 90 } } };
export const Instruction: Story = {
  args: { item: { ...skill, kind: "rule", bytes: 4000, usage: null } as SetupRow, loadedIn: [{ path: "/code/web", name: "web" }], usage: null },
};
export const NoUsageKind: Story = { args: { item: { ...skill, kind: "hook" } as SetupRow, usage: null } };
export const Loading: Story = { args: { usage: null } };
