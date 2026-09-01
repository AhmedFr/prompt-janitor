import type { Meta, StoryObj } from "@storybook/react";
import { ScanBar } from "./ScanBar";
import "@/styles/shell.css";

/** The one progress bar every scan draws, whichever screen started it. */
const meta = {
  title: "Components/ScanBar",
  component: ScanBar,
  parameters: { layout: "padded" },
} satisfies Meta<typeof ScanBar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Grading files — the phase that has a counter behind it. */
export const Grading: Story = {
  args: { progress: { done: 42, total: 120 }, status: "Grading 42/120 files" },
};

/** The harness pass: running, but with nothing countable to report yet. */
export const Indeterminate: Story = {
  args: { progress: null, status: "Indexing Claude Code sessions…" },
};

/** The last frame before `scan-done` lands. */
export const Finishing: Story = {
  args: { progress: { done: 120, total: 120 }, status: "Grading 120/120 files" },
};

/** Borrowed by Settings → App for an update download, with its own label. */
export const UpdateDownload: Story = {
  args: {
    progress: { done: 4_100_000, total: 12_800_000 },
    status: "Downloading 4.1 MB of 12.8 MB",
    label: "Update download progress",
  },
};
