import type { Meta, StoryObj } from "@storybook/react";
import { FileActions } from "./index";

const meta = {
  title: "Screens/Setup/FileActions",
  component: FileActions,
  parameters: { layout: "padded" },
  args: { artifactId: 7, content: "# Adapt\n", onError: () => {} },
  decorators: [
    (Story) => (
      <div style={{ display: "flex", gap: 2 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FileActions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Copy, Reveal, Open — quiet until pointed at. */
export const Ready: Story = {};

/** Before the read lands there is nothing to copy. */
export const NotReadYet: Story = { args: { content: null } };
