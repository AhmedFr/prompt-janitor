import type { Meta, StoryObj } from "@storybook/react";
import { UpdateBanner } from "./UpdateBanner";
import "@/styles/shell.css";

/** The one line the shell shows when the launch probe finds a newer build. */
const meta = {
  title: "Components/UpdateBanner",
  component: UpdateBanner,
  parameters: { layout: "fullscreen" },
  args: { version: "0.1.1", onOpen: () => {}, onDismiss: () => {} },
} satisfies Meta<typeof UpdateBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A patch release on offer. */
export const Available: Story = {};

/** A long version string still leaves the two actions reachable. */
export const LongVersion: Story = {
  args: { version: "1.0.0-rc.4+build.20260901" },
};
