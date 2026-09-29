import type { Meta, StoryObj } from "@storybook/react";
import type { FileDetail } from "@/lib/ipc";
import type { FindingsState } from "../Findings";
import type { ArtifactSourceState } from "../Setup.types";
import type { SetupRow } from "../setupRows.util";
import { ItemViewerView } from "./index";

/**
 * The stories render `ItemViewerView`, not `ItemViewer`: the connected
 * component reads through Tauri IPC, which answers nothing in Storybook, so
 * every story would sit on "Loading…". Handing the file (and the Findings and
 * Usage tabs' data) in as props is also the only way to stage the states that
 * need a failure without one.
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
].join("\n");

const AGENT = ["---", "name: reviewer", "description: Reviews diffs before they land", "---", "", "You review diffs.", ""].join("\n");

const MCP_JSON = '{\n  "command": "npx",\n  "args": ["-y", "@posthog/mcp"],\n  "env": {\n    "POSTHOG_KEY": "••••••"\n  }\n}';

const INSTRUCTIONS = "# Shop\n\nRun npm install before anything else.\n";

const row = (over: Partial<SetupRow>): SetupRow => ({
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
  issue_count: null,
  worst_severity: null,
  usage: null,
  origin: "inventory",
  project_label: null,
  project_path: null,
  load_order: null,
  ...over,
});

const skill = row({});
const agent = row({ id: 8, kind: "agent", name: "reviewer", path: "/Users/a/.claude/agents/reviewer.md", description: null });
const mcp = row({ id: 11, kind: "mcp_server", name: "posthog", path: "/Users/a/.claude.json", description: null });
const instruction = row({
  id: 12,
  layer: "project",
  kind: "rule",
  name: "CLAUDE.md",
  path: "/code/shop/CLAUDE.md",
  description: null,
  bytes: 4000,
  grade: "C",
  score: 70,
  file_id: "/code/shop/CLAUDE.md",
  issue_count: 2,
  worst_severity: "hi",
  project_path: "/code/shop",
});
const graded = row({
  id: -1234,
  harness: "",
  layer: "project",
  kind: "rule",
  name: "AGENTS.md",
  path: "/code/shop/AGENTS.md",
  description: null,
  bytes: 0,
  grade: "B",
  score: 84,
  file_id: "/code/shop/AGENTS.md",
  origin: "graded",
  project_label: "shop",
});

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
  reload: () => {},
  ...over,
});

const detail: FileDetail = {
  id: "/code/shop/CLAUDE.md",
  name: "CLAUDE.md",
  project: "shop",
  path: "/code/shop/CLAUDE.md",
  grade: "C",
  score: 70,
  content: INSTRUCTIONS,
  delta: null,
  dimensions: [
    { dimension: "Clarity", score: 50 },
    { dimension: "Consistency", score: 60 },
    { dimension: "Structure", score: 90 },
    { dimension: "Examples", score: 90 },
    { dimension: "Format", score: 90 },
  ],
  issues: [
    {
      line: 3,
      severity: "hi",
      source: "anthropic",
      title: "Wrong package manager",
      why: "The repo has a pnpm lockfile, but this file tells the agent to run npm.",
      fix_from: "npm install",
      fix_to: "pnpm install",
    },
    {
      line: null,
      severity: "lo",
      source: "custom",
      title: "No examples",
      why: "A short example of the expected output makes the instruction far easier to follow.",
      fix_from: null,
      fix_to: null,
    },
  ],
};

const findings: FindingsState = { detail, loading: false, aiReady: false, entitled: true, reload: async () => {} };

const LOADED_IN = [
  { path: "/code/shop", name: "shop" },
  { path: "/code/shop/web", name: "shop-web" },
];

const meta = {
  title: "Screens/Setup/ItemViewer",
  component: ItemViewerView,
  parameters: { layout: "fullscreen" },
  args: {
    item: skill,
    scope: "Global",
    source: source(),
    tab: "content",
    onTab: () => {},
    onClose: () => {},
    onStep: () => {},
    onSaved: () => {},
    loadedIn: [],
    onSelectProject: () => {},
  },
  decorators: [
    // Something behind the drawer, so the scrim and the drawer's left edge
    // read the way they do over a real table.
    (Story) => (
      <div style={{ height: "100vh", background: "var(--win-bg)", padding: 24 }}>
        <p className="muted" style={{ fontSize: 12 }}>
          Setup table sits here.
        </p>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ItemViewerView>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A skill on the Content tab: meta line, path with step buttons, tabs, then the rendered body. */
export const SkillContent: Story = {};

/** The editor holds the raw file, frontmatter and all; stepping waits until it closes. */
export const SkillEditing: Story = { args: { initialMode: "edit" } };

/** An agent's markdown, which the backend accepts a save for. */
export const AgentEditable: Story = {
  args: { item: agent, scope: "Global", source: source({ content: AGENT, path: agent.path }) },
};

/** An MCP server: the backend's redacted excerpt, read-only. */
export const McpReadOnly: Story = {
  args: { item: mcp, source: source({ content: MCP_JSON, path: mcp.path, format: "json", editable: false }) },
};

/** A project's instruction file on its Findings tab, loaded in two projects. */
export const InstructionFindings: Story = {
  args: {
    item: instruction,
    scope: "shop",
    tab: "findings",
    loadedIn: LOADED_IN,
    findings,
    source: source({ content: INSTRUCTIONS, path: instruction.path }),
  },
};

/** The same file on its Usage tab: what loading it every session costs, and where. */
export const InstructionUsage: Story = {
  args: {
    item: instruction,
    scope: "shop",
    tab: "usage",
    loadedIn: LOADED_IN,
    usage: null,
    source: source({ content: INSTRUCTIONS, path: instruction.path }),
  },
};

/** A graded file the inventory never saw: read through its file detail, never editable. */
export const GradedOnlyFile: Story = {
  args: {
    item: graded,
    scope: "shop",
    source: source({ content: "# Agents\n\nBe terse.\n", path: graded.path, editable: false, modified: null }),
  },
};

/** The read failed — the viewer says so rather than showing an empty document. */
export const ReadFailed: Story = {
  args: {
    source: source({ content: null, error: "Couldn't open the file: No such file or directory (os error 2)" }),
  },
};

/** The file has not arrived yet. */
export const Loading: Story = {
  args: { source: source({ content: null, path: null, loading: true }) },
};
