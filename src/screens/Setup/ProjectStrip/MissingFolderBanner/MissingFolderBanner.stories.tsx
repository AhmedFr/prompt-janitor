import type { Meta, StoryObj } from "@storybook/react";
import { MissingFolderBanner } from "./MissingFolderBanner";
import "@/styles/shell.css";

const meta = {
  title: "Screens/Setup/ProjectStrip/MissingFolderBanner",
  component: MissingFolderBanner,
  parameters: { layout: "padded" },
} satisfies Meta<typeof MissingFolderBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The banner that rides above a project whose folder is gone. */
export const Default: Story = {};
