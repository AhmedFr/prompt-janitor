import type { Meta, StoryObj } from "@storybook/react";
import type { RuleInfo } from "@/lib/ipc";
import { ChecksLibrary } from "./ChecksLibrary";
import { AddCheck } from "./AddCheck";
import { ChecksTab } from "./ChecksTab";
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

const rules: RuleInfo[] = [
  rule({
    id: "b1",
    title: "No Slack references",
    description: "A prompt that names your chat tool ages the moment you switch.",
    severity: "hi",
    hit_count: 7,
  }),
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
];

/**
 * Settings → Checks: the check library, and the add-check form in its place
 * while it is open. `ChecksTab` itself reads the live rule set through
 * `useChecksLibrary`, which needs Tauri behind the window — Storybook has
 * none, so each story renders the sub-screen it documents directly, with a
 * fixture standing in for the hook.
 */
const meta = {
  title: "Screens/Settings/ChecksTab",
  component: ChecksTab,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div style={{ height: "100vh", background: "var(--bg)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ChecksTab>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The check library — what `ChecksTab` shows once the add form is closed. */
export const Library: Story = {
  render: () => <ChecksLibrary rules={rules} onAdd={() => {}} />,
};

/** The add-check form, open in the library's place. */
export const Adding: Story = {
  render: () => <AddCheck initialType="custom" aiReady onDone={() => {}} />,
};
