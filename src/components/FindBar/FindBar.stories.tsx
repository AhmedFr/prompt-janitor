import type { Meta, StoryObj } from "@storybook/react";
import { FindBar } from "./index";

const meta = {
  title: "Components/FindBar",
  component: FindBar,
  parameters: { layout: "padded" },
  args: { onQueryChange: () => {}, onNext: () => {}, onPrev: () => {}, onClose: () => {} },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 640 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FindBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Matches: Story = { args: { query: "env", count: 12, current: 2 } };
export const NoMatches: Story = { args: { query: "zzz", count: 0, current: -1 } };
export const Empty: Story = { args: { query: "", count: 0, current: -1 } };
