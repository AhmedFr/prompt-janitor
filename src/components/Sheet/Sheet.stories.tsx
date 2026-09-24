import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@/components/Button";
import { Sheet, SheetPath } from "./index";

const meta = {
  title: "Components/Sheet",
  component: Sheet,
  parameters: { layout: "fullscreen" },
  args: {
    title: "posthog",
    subtitle: "MCP server",
    onClose: () => {},
    toolbar: <SheetPath path="/Users/a/.claude.json" />,
    children: <p>The body scrolls on its own while the header and footer stay put.</p>,
  },
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Header, path, body — the read-only shape every non-skill row opens in. */
export const Basic: Story = {};

/** With a footer of actions, as the skill editor uses it. */
export const WithFooter: Story = {
  args: {
    footer: (
      <>
        <span className="toolbar-spacer" />
        <Button size="sm">Cancel</Button>
        <Button variant="primary" size="sm">
          Save
        </Button>
      </>
    ),
  },
};

/** A failed read or save pinned above the footer. */
export const WithError: Story = {
  args: { error: "That entry is no longer in .claude.json." },
};

/** The reader: most of the window, for a sheet whose point is a file's text. */
export const Wide: Story = { args: { size: "wide" } };

/** A body long enough to scroll. */
export const LongBody: Story = {
  args: {
    children: (
      <>
        {Array.from({ length: 40 }, (_, i) => (
          <p key={i}>Paragraph {i + 1} of a long file.</p>
        ))}
      </>
    ),
  },
};
