import type { Meta, StoryObj } from "@storybook/react";
import { Markdown } from "./index";

const meta = {
  title: "Components/Markdown",
  component: Markdown,
  parameters: { layout: "padded" },
  decorators: [
    // The panel this renders in is narrow; a full-width story would flatter
    // the line lengths in a way the real screen never does.
    (Story) => (
      <div style={{ maxWidth: 520 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Markdown>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A realistic skill body — the shape almost every `SKILL.md` actually takes. */
export const SkillBody: Story = {
  args: {
    source: [
      "# Shipping a feature",
      "",
      "Every change reaches `main` the same way: **issue → branch → PR**.",
      "",
      "## The checklist",
      "",
      "1. Open an issue with acceptance criteria",
      "2. Branch from a fresh `main`",
      "3. Write the failing test *first*",
      "",
      "### Gates",
      "",
      "- `pnpm check` must pass before the PR opens",
      "- The owner is the merge reviewer",
      "",
      "```sh",
      "git switch -c feat/175-skill-panel",
      "pnpm check",
      "```",
      "",
      "> Absence of enforcement is why this skill exists.",
      "",
      "---",
      "",
      "See the [contributing guide](https://example.dev/contributing).",
    ].join("\n"),
  },
};

/** Every block kind at once, for spacing and rhythm review. */
export const AllBlocks: Story = {
  args: {
    source: [
      "# Heading 1",
      "## Heading 2",
      "### Heading 3",
      "#### Heading 4",
      "",
      "A paragraph with **bold**, *italic*, `inline code` and a [link](https://x.dev).",
      "",
      "- unordered one",
      "- unordered two",
      "",
      "1. ordered one",
      "2. ordered two",
      "",
      "```json",
      '{ "name": "prompt-janitor" }',
      "```",
      "",
      "```",
      "a fence with no language",
      "```",
      "",
      "> A blockquote, which wraps onto a second line when the panel is narrow.",
      "",
      "---",
    ].join("\n"),
  },
};

/**
 * Markup inside a skill file is content, not code. Nothing here executes or
 * renders as an element — it all comes out as visible text.
 */
export const EmbeddedHtmlStaysText: Story = {
  args: {
    source: [
      "<img src=x onerror=alert(1)>",
      "",
      "<script>alert(2)</script>",
      "",
      "[a refused link](javascript:alert(3))",
    ].join("\n"),
  },
};

/** Long unbroken tokens — a path or a URL — must not push the panel sideways. */
export const LongTokens: Story = {
  args: {
    source: [
      "/Users/someone/.claude/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/brainstorming/SKILL.md",
      "",
      "```",
      "pnpm --filter @prompt-janitor/fulfillment exec vitest run --coverage --reporter=verbose",
      "```",
    ].join("\n"),
  },
};

/** Nothing to show — renders an empty container rather than a placeholder. */
export const Empty: Story = { args: { source: "" } };
