import type { Meta, StoryObj } from "@storybook/react";
import "../ItemViewer.css";
import { DiscardConfirm } from "./index";

const meta = {
  title: "Screens/Setup/ItemViewer/DiscardConfirm",
  component: DiscardConfirm,
  parameters: { layout: "fullscreen" },
  args: { onKeep: () => {}, onDiscard: () => {} },
  decorators: [
    // The confirm covers its viewer, so it needs a positioned box to cover.
    (Story) => (
      <div style={{ position: "relative", height: 320, background: "var(--card)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DiscardConfirm>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Asked when a close or a Cancel would lose a draft. */
export const Asking: Story = {};
