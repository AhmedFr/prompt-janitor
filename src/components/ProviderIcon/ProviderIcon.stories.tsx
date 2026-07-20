import type { Meta, StoryObj } from "@storybook/react";
import { ProviderIcon } from "./ProviderIcon";
import { PROVIDERS } from "./ProviderIcon.constants";

const meta = {
  title: "Components/ProviderIcon",
  component: ProviderIcon,
  args: { kind: "CLAUDE.md" },
} satisfies Meta<typeof ProviderIcon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const All: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 10 }}>
      {Object.keys(PROVIDERS).map((k) => (
        <ProviderIcon key={k} kind={k} />
      ))}
    </div>
  ),
};
