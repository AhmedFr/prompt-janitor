import type { Meta, StoryObj } from "@storybook/react";
import { AlertRow } from "./AlertRow";
import "../../Settings.css";

const meta = {
  title: "Screens/Settings/NotificationsTab/AlertRow",
  component: AlertRow,
  args: {
    label: "Weekly digest",
    detail: "A summary of the week's changes",
    on: true,
    onToggle: () => {},
  },
} satisfies Meta<typeof AlertRow>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The toggle is on. */
export const On: Story = {};

/** The toggle is off. */
export const Off: Story = {
  args: { on: false },
};
