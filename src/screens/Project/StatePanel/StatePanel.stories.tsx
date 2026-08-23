import type { Meta, StoryObj } from "@storybook/react";
import { MissingFolderBanner } from "./MissingFolderBanner";
import { StatePanel } from "./StatePanel";
import {
  FAILED_BODY,
  FAILED_RETRY,
  FAILED_TITLE,
  NO_SELECTION_BODY,
  NO_SELECTION_TITLE,
  NOT_FOUND_BODY,
  NOT_FOUND_TITLE,
} from "../Project.constants";
import "@/styles/shell.css";

const meta = {
  title: "Screens/Project/StatePanel",
  component: StatePanel,
  args: { title: NO_SELECTION_TITLE, body: NO_SELECTION_BODY, onBack: () => {} },
  parameters: { layout: "padded" },
} satisfies Meta<typeof StatePanel>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The route was reached without a project to open. */
export const NoSelection: Story = {};

/** Every read succeeded and none of them knows this path. */
export const NotFound: Story = { args: { title: NOT_FOUND_TITLE, body: NOT_FOUND_BODY } };

/** The read failed — the only state where retrying is a real option. */
export const Unreadable: Story = {
  args: {
    title: FAILED_TITLE,
    body: FAILED_BODY,
    retry: { label: FAILED_RETRY, onClick: () => {} },
  },
};

/** The banner that rides above a loaded project whose folder is gone. */
export const MissingFolder: StoryObj = { render: () => <MissingFolderBanner /> };
