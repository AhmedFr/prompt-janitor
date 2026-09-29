import type { Meta, StoryObj } from "@storybook/react";
import { AboutTab } from "./AboutTab";
import "../Settings.css";

const meta = {
  title: "Screens/Settings/AboutTab",
  component: AboutTab,
  args: {
    status: { schema_version: 9, db_path: "/Users/dev/Library/Application Support/pj.db", project_count: 3, file_count: 128 },
  },
  decorators: [
    (Story) => (
      <div className="page" style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AboutTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Status loaded: counts and storage path shown. */
export const WithStatus: Story = {};

/** Still loading: dashes instead of counts. */
export const NoStatus: Story = {
  args: { status: null },
};
