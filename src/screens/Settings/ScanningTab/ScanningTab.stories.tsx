import type { Meta, StoryObj } from "@storybook/react";
import { ScanningTab } from "./ScanningTab";
import "../Settings.css";

const meta = {
  title: "Screens/Settings/ScanningTab",
  component: ScanningTab,
  args: {
    schedule: "6h",
    onChange: () => {},
  },
  decorators: [
    (Story) => (
      <div className="page" style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ScanningTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The recommended balance, picked by default. */
export const Recommended: Story = {};

/** Scanning turned off — the user scans on demand. */
export const Manual: Story = {
  args: { schedule: "manual" },
};
