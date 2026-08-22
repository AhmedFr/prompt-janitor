import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { RankedList } from "./RankedList";
import type { RankedRow } from "./RankedList.types";

const TOP_ROWS: RankedRow[] = [
  { id: "1", label: "web-conventions", value: 96, secondary: "9 sessions" },
  { id: "2", label: "release-checklist", value: 64, secondary: "5 sessions" },
  { id: "3", label: "pdf-extract", value: 41, secondary: "4 sessions" },
  { id: "4", label: "rust-review", value: 28, secondary: "3 sessions" },
  { id: "5", label: "commit-message", value: 12, secondary: "2 sessions" },
];

const ERROR_ROWS: RankedRow[] = [
  { id: "1", label: "release-checklist", value: 0.4, secondary: "5 uses" },
  { id: "2", label: "flaky-mcp-server", value: 0.25, secondary: "12 uses" },
  { id: "3", label: "rust-review", value: 0.05, secondary: "20 uses" },
];

const meta: Meta<typeof RankedList> = {
  title: "Components/RankedList",
  component: RankedList,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof RankedList>;

export const Default: Story = {
  args: { title: "Top used", rows: TOP_ROWS, empty: "No usage recorded yet." },
};

export const ErrorVariant: Story = {
  args: {
    title: "Most errors",
    rows: ERROR_ROWS,
    variant: "error",
    format: (v) => `${Math.round(v * 100)}%`,
    empty: "No errors recorded yet.",
  },
};

/** The selector chips switch which kind of target the list is ranking. */
function WithSelectorDemo() {
  const [active, setActive] = useState("skills");
  return (
    <RankedList
      title="Top used"
      rows={TOP_ROWS}
      empty="No usage recorded yet."
      selector={{
        options: [
          { id: "skills", label: "Skills" },
          { id: "agents", label: "Agents" },
          { id: "mcp", label: "MCP" },
          { id: "commands", label: "Commands" },
        ],
        active,
        onChange: setActive,
      }}
      details={{ label: "See all in Setup", onClick: () => {} }}
    />
  );
}

export const WithSelector: Story = { render: () => <WithSelectorDemo /> };

export const Empty: Story = {
  args: { title: "Top used", rows: [], empty: "Nothing scanned yet — run a scan to populate this." },
};
