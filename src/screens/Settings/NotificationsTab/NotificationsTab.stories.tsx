import type { Meta, StoryObj } from "@storybook/react";
import { NotificationsTab } from "./NotificationsTab";
import "../Settings.css";

const meta = {
  title: "Screens/Settings/NotificationsTab",
  component: NotificationsTab,
  args: {
    digest: true,
    regressions: true,
    onDigest: () => {},
    onRegressions: () => {},
  },
  decorators: [
    (Story) => (
      <div className="page" style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof NotificationsTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Both alerts on. */
export const AllOn: Story = {};

/** Both alerts off. */
export const AllOff: Story = {
  args: { digest: false, regressions: false },
};
