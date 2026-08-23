import type { Meta, StoryObj } from "@storybook/react";
import type { RuleInfo } from "@/lib/ipc";
import { Rules } from "./Rules";
import "@/styles/shell.css";

const rule = (o: Partial<RuleInfo> = {}): RuleInfo => ({
  id: "r",
  title: "rule",
  description: "",
  source: "anthropic",
  severity: "mid",
  enabled: true,
  custom: false,
  nl: false,
  pattern: null,
  hit_count: 0,
  ...o,
});

/**
 * Mirrors `list_rules` (`src-tauri/src/query.rs`): built-in *pattern* rules
 * are Rust code, so they carry no pattern and no row action at all.
 */
const builtIn: RuleInfo[] = [
  rule({
    id: "b1",
    title: "No Slack references",
    description: "A prompt that names your chat tool ages the moment you switch.",
    severity: "hi",
    hit_count: 7,
  }),
  rule({
    id: "b2",
    title: "State the output format",
    description: "An answer with no named shape costs a round trip to correct.",
    source: "openai",
    severity: "hi",
    hit_count: 4,
  }),
  rule({
    id: "b3",
    title: "Keep the preamble short",
    description: "Every restated instruction is paid for on every turn.",
    source: "karpathy",
    severity: "mid",
    hit_count: 2,
  }),
  rule({
    id: "b4",
    title: "No trailing whitespace",
    description: "Cosmetic, but it churns diffs for no reason.",
    source: "cursor",
    severity: "lo",
    enabled: false,
  }),
  rule({
    id: "b5",
    title: "Name the tools it may call",
    description: "An unbounded tool list is an unbounded bill.",
    severity: "mid",
  }),
];

/** Everything the user made: `custom`, with a pattern, so both actions apply. */
const custom: RuleInfo[] = [
  rule({
    id: "c1",
    title: "Never say synergy",
    description: "Flags prompts containing “synergy”.",
    source: "custom",
    custom: true,
    severity: "lo",
    hit_count: 1,
    pattern: "synergy",
  }),
  rule({
    id: "c2",
    title: "No internal hostnames",
    description: "Flags prompts containing “corp.internal”.",
    source: "custom",
    custom: true,
    severity: "hi",
    hit_count: 3,
    pattern: "corp.internal",
  }),
];

/**
 * Both kinds of standard side by side: the shipped one can only be copied, the
 * user's own can be copied *and* deleted — which is the row-driven actions
 * column doing the thing a tab-driven one got wrong.
 */
const standards: RuleInfo[] = [
  rule({
    id: "n1",
    title: "Defines an explicit output format",
    description: "Must define an explicit output format",
    severity: "hi",
    nl: true,
    hit_count: 5,
    pattern: "Must define an explicit output format",
  }),
  rule({
    id: "n2",
    title: "Says what to do when it is unsure",
    description: "AI rule — Must say what to do when the answer is not known",
    source: "custom",
    custom: true,
    nl: true,
    severity: "mid",
    enabled: false,
    pattern: "Must say what to do when the answer is not known",
  }),
];

const populated = [...builtIn, ...custom, ...standards];

/**
 * Tables and tab strips remember themselves in `sessionStorage`, which
 * outlives a story swap — so every story starts from a clean slate. Written
 * during the decorator's render, before the screen below it mounts and reads.
 */
const clearRememberedState = () => {
  for (const key of Object.keys(window.sessionStorage)) {
    if (key.startsWith("pj.table.") || key.startsWith("pj.tabs.")) {
      window.sessionStorage.removeItem(key);
    }
  }
};

/**
 * Every rule the app enforces, as three tables: what shipped, what you wrote,
 * and what your AI provider judges. Storybook feeds the screen a fixture
 * through the `rules` prop — in the app it comes from `useRules`.
 */
const meta = {
  title: "Screens/Rules",
  component: Rules,
  args: { navigate: () => {}, rules: populated },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => {
      clearRememberedState();
      return (
        <div style={{ height: "100vh", background: "var(--bg)" }}>
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<typeof Rules>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The built-in packs, sorted worst-severity first, with pack import in the toolbar. */
export const Populated: Story = {};

/**
 * The AI standards tab. Storybook has no Tauri to ask about a provider, so
 * the note reads as the not-yet-connected state — which is also what a fresh
 * install sees.
 */
export const AiStandards: Story = {
  args: { initialTab: "ai" },
};

/** Nothing of your own yet — the table says so, and the CTA is the way out of it. */
export const EmptyCustom: Story = {
  args: { initialTab: "custom", rules: [...builtIn, ...standards] },
};
