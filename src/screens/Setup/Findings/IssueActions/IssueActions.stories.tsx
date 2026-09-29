import type { Meta, StoryObj } from "@storybook/react";
import type { FileDetail } from "@/lib/ipc";
import { IssueActions } from "./IssueActions";

type Issue = FileDetail["issues"][number];

const withFix: Issue = {
  line: 12,
  severity: "hi",
  source: "anthropic",
  title: "Wrong package manager",
  why: "The repo has a pnpm lockfile, but this file tells the agent to run npm.",
  fix_from: "npm install",
  fix_to: "pnpm install",
};

const noFix: Issue = {
  line: null,
  severity: "lo",
  source: "custom",
  title: "No examples",
  why: "A short example of the expected output makes the instruction far easier to follow.",
  fix_from: null,
  fix_to: null,
};

/**
 * Storybook has no desktop runtime, so the backup lookup is skipped and Undo
 * never shows; Apply and Suggest fix render but answer nothing.
 */
const meta = {
  title: "Screens/Setup/Findings/IssueActions",
  component: IssueActions,
  args: { issue: withFix, fileId: "story", index: 0, aiReady: false, entitled: true, onReload: async () => {} },
} satisfies Meta<typeof IssueActions>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A finding with a deterministic fix: the diff, Apply and the git option. */
export const WithFix: Story = {};

/** A finding with no fix and no AI provider: the why, and where to connect one. */
export const NoFix: Story = {
  args: { issue: noFix },
};

/** A provider is set up: Suggest fix with AI sits above the fix. */
export const AiReady: Story = {
  args: { aiReady: true },
};
