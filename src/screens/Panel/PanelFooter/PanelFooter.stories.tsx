import type { Meta, StoryObj } from "@storybook/react";
import type { ScanProgressState } from "@/lib/useScanProgress";
import { PanelFooter } from "./PanelFooter";

const idle: ScanProgressState = { phase: null, progress: null, reset: () => {} };

/** Scan, hand over to the app, or quit. */
const meta = {
  title: "Screens/Panel/PanelFooter",
  component: PanelFooter,
  args: {
    scanning: false,
    scan: idle,
    onScan: () => {},
    onOpenApp: () => {},
    onQuit: () => {},
  },
  decorators: [
    (Story) => (
      <div style={{ width: 360, background: "var(--card)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PanelFooter>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing running. */
export const Idle: Story = {};

/** A scan in flight, halfway through grading. */
export const Scanning: Story = {
  args: {
    scanning: true,
    scan: { phase: "files", progress: { done: 12, total: 40 }, reset: () => {} },
  },
};
