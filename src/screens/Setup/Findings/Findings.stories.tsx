import type { Meta, StoryObj } from "@storybook/react";
import type { FileDetail } from "@/lib/ipc";
import { Findings } from "./Findings";
import type { FindingsState } from "./Findings.types";

const detail: FileDetail = {
  id: "/code/shop/CLAUDE.md",
  name: "CLAUDE.md",
  project: "shop",
  path: "/code/shop/CLAUDE.md",
  grade: "C",
  score: 70,
  content: "# Shop\n\nRun npm install before anything else.\n",
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

/** A settled file with no AI provider — overridden per story. */
const findings = (over: Partial<FindingsState> = {}): FindingsState => ({
  detail,
  loading: false,
  aiReady: false,
  entitled: true,
  reload: async () => {},
  ...over,
});

const meta = {
  title: "Screens/Setup/Findings",
  component: Findings,
  args: { fileId: detail.id, onJumpToLine: () => {}, findings: findings() },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 560, padding: 16 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Findings>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A graded file with a fixable and an unfixable finding: the strip, Fix all, and the list. */
export const WithFindings: Story = {};

/** A graded file the checks found nothing on. */
export const Clean: Story = {
  args: { findings: findings({ detail: { ...detail, grade: "A", score: 96, issues: [] } }) },
};

/** An item the grader never grades (a skill, a hook, a config file…). */
export const NotGraded: Story = {
  args: { fileId: null, findings: findings({ detail: null }) },
};

/** The file has not arrived yet. */
export const Loading: Story = {
  args: { findings: findings({ detail: null, loading: true }) },
};
