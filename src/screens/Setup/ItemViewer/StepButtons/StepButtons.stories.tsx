import type { Meta, StoryObj } from "@storybook/react";
import "../ItemViewer.css";
import { StepButtons } from "./index";

const meta = {
  title: "Screens/Setup/ItemViewer/StepButtons",
  component: StepButtons,
  parameters: { layout: "padded" },
  args: { onStep: () => {} },
} satisfies Meta<typeof StepButtons>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Previous and next item, as they sit at the end of the path bar. */
export const Ready: Story = {};

/** Held while the viewer is editing. */
export const Disabled: Story = { args: { disabled: true } };
