import type { Meta, StoryObj } from "@storybook/react";
import type { ArtifactView } from "@/lib/ipc";
import { SkillPanelView } from "./index";
import type { ArtifactSourceState } from "../Setup.types";

/**
 * The stories render `SkillPanelView`, not `SkillPanel`: the connected
 * component reads through Tauri IPC, which answers nothing in Storybook, so
 * every story would sit on "Loading…". Handing the file in as a prop is also
 * the only way to stage the states that need a failure — a refused read, a
 * refused save — without one.
 */
const SOURCE = [
  "---",
  "name: shipping-a-feature",
  "description: Use when making ANY change to the repo that will reach main",
  "allowed-tools: Bash, Read, Edit",
  "---",
  "",
  "# Shipping a feature",
  "",
  "Every change reaches `main` the same way: **issue → branch → PR**.",
  "",
  "## The checklist",
  "",
  "1. Open an issue with acceptance criteria",
  "2. Branch from a fresh `main`",
  "3. Write the failing test first",
  "",
  "```sh",
  "pnpm check",
  "```",
  "",
  "> Absence of enforcement is why this skill exists.",
].join("\n");

const skill: ArtifactView = {
  id: 7,
  harness: "claude_code",
  layer: "global",
  kind: "skill",
  name: "shipping-a-feature",
  path: "/Users/a/.claude/skills/shipping-a-feature/SKILL.md",
  plugin_name: null,
  description: "Use when making ANY change to the repo that will reach main",
  bytes: 4096,
  grade: null,
  score: null,
  file_id: null,
  usage: null,
};

/** A settled `ArtifactSourceState` whose save always succeeds — overridden per story. */
const source = (over: Partial<ArtifactSourceState> = {}): ArtifactSourceState => ({
  content: SOURCE,
  path: skill.path,
  format: "markdown",
  editable: true,
  modified: "1757462400000000000",
  loading: false,
  saving: false,
  error: null,
  save: async () => 4096,
  ...over,
});

const meta = {
  title: "Screens/Setup/SkillPanel",
  component: SkillPanelView,
  parameters: { layout: "fullscreen" },
  args: { skill, scope: "Global", source: source(), onClose: () => {}, onSaved: () => {} },
  decorators: [
    // Something behind the drawer, so the scrim and the drawer's left edge
    // read the way they do over a real table.
    (Story) => (
      <div style={{ height: "100vh", background: "var(--win-bg)", padding: 24 }}>
        <p className="muted" style={{ fontSize: 12 }}>
          Setup → Skills table sits here.
        </p>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SkillPanelView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** What the panel looks like in the app: header strip, then the rendered body. */
export const Reading: Story = {};

/** The file has not arrived yet. */
export const Loading: Story = {
  args: { source: source({ content: null, path: null, loading: true }) },
};

/** A skill whose file is nothing but a header. */
export const FrontmatterOnly: Story = {
  args: { source: source({ content: "---\nname: stub\ndescription: not written yet\n---\n" }) },
};

/** A file with no header at all — plain markdown, no strip. */
export const NoFrontmatter: Story = {
  args: { source: source({ content: "# Just a body\n\nNo header on this one." }) },
};

/** The read failed — the panel says so rather than showing an empty document. */
export const ReadFailed: Story = {
  args: {
    source: source({
      content: null,
      error: "Couldn't open the file: No such file or directory (os error 2)",
    }),
  },
};

/** The editor holds the raw file, frontmatter and all. */
export const Editing: Story = { args: { initialMode: "edit" } };

/** The save is in flight — both actions are held until it lands. */
export const Saving: Story = {
  args: { initialMode: "edit", source: source({ saving: true }) },
};

/** The save was refused: the draft stays in the editor and the reason is shown. */
export const SaveFailed: Story = {
  args: {
    initialMode: "edit",
    source: source({ error: "That file is no longer on disk.", save: async () => null }),
  },
};

/** A long path truncates from the left, so the filename survives. */
export const LongPath: Story = {
  args: {
    source: source({
      path: "/Users/someone/.claude/plugins/cache/claude-plugins-official/superpowers/6.3.0/skills/shipping-a-feature/SKILL.md",
    }),
  },
};
