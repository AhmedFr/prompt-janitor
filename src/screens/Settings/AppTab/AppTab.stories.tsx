import type { Meta, StoryObj } from "@storybook/react";
import { AppTabBody } from "./AppTab";
import { NO_RELEASES } from "./AppTab.constants";
import "../Settings.css";

const noop = async () => {};

const meta = {
  title: "Screens/Settings/AppTab",
  component: AppTabBody,
  args: {
    version: "0.1.0",
    update: { kind: "idle" },
    check: noop,
    install: noop,
    danger: "",
    dangerResult: null,
    reset: noop,
    uninstall: noop,
  },
  decorators: [
    (Story) => (
      <div className="page" style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AppTabBody>;

export default meta;
type Story = StoryObj<typeof meta>;

/** How the tab opens: the running version, nothing asked yet. */
export const Idle: Story = {};

/** Mid-round-trip. */
export const Checking: Story = { args: { update: { kind: "checking" } } };

/** The common answer. */
export const UpToDate: Story = { args: { update: { kind: "current" } } };

/** A release on offer, with its notes. */
export const Available: Story = {
  args: {
    update: {
      kind: "available",
      version: "0.1.1",
      notes: "Template tray icon, scaled score ring, calmer table rows.",
    },
  },
};

/** The download in flight, on the shared progress bar. */
export const Downloading: Story = {
  args: {
    update: { kind: "downloading", version: "0.1.1", downloaded: 4_100_000, total: 12_800_000 },
  },
};

/** Installed — the last frame before the app comes back up. */
export const Restarting: Story = { args: { update: { kind: "restarting", version: "0.1.1" } } };

/** Before the first tag exists there is nothing to serve; that is not a fault. */
export const NoReleasesYet: Story = {
  args: { update: { kind: "error", message: NO_RELEASES } },
};

/** A reset in flight — both destructive buttons are out of reach. */
export const Resetting: Story = { args: { danger: "reset" } };

/** What a finished reset reports. */
export const ResetDone: Story = {
  args: { dangerResult: { ok: true, message: "Deleted 3 local files and started a fresh database." } },
};

/** A destructive action that failed says so where it was triggered. */
export const DangerFailed: Story = {
  args: { dangerResult: { ok: false, message: "database is locked" } },
};
