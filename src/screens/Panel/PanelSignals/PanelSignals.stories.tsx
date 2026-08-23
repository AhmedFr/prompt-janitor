import type { Meta, StoryObj } from "@storybook/react";
import { PanelSignals } from "./PanelSignals";

/** The three usage signals, each a button to where it is fixed. */
const meta = {
  title: "Screens/Panel/PanelSignals",
  component: PanelSignals,
  args: { neverUsedSkills: 3, mcpErroring: 1, sessionsToday: 12, onOpen: () => {} },
  decorators: [
    (Story) => (
      <div style={{ width: 360, background: "var(--card)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PanelSignals>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Things to deal with: unused skills and an erroring server. */
export const Problems: Story = {};

/** Nothing wrong — the chips stay neutral. */
export const Clean: Story = {
  args: { neverUsedSkills: 0, mcpErroring: 0, sessionsToday: 4 },
};
