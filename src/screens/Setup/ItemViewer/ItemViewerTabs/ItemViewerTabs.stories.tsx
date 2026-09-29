import type { Meta, StoryObj } from "@storybook/react";
import "../ItemViewer.css";
import { ItemViewerTabs } from "./index";

const meta = {
  title: "Screens/Setup/ItemViewer/ItemViewerTabs",
  component: ItemViewerTabs,
  parameters: { layout: "padded" },
  args: { active: "content", onChange: () => {}, findingsCount: null },
} satisfies Meta<typeof ItemViewerTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The viewer opens on the file itself. */
export const ContentActive: Story = {};

/** Open findings are counted on their tab, in the error tint. */
export const FindingsWithCount: Story = { args: { active: "findings", findingsCount: 4 } };

/** Usage picked; an item with no findings shows no count. */
export const UsageActive: Story = { args: { active: "usage" } };

/** A draft is open on Content: Findings and Usage wait until it is saved or dropped. */
export const Editing: Story = { args: { findingsCount: 2, editing: true } };
