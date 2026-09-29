import type { Meta, StoryObj } from "@storybook/react";
import { Onboarding } from "./Onboarding";
import type { OnboardingState } from "./Onboarding.types";
import type { HarnessInfo } from "@/lib/ipc";
import "@/styles/shell.css";

const claudeCode: HarnessInfo = {
  id: "claude_code",
  display_name: "Claude Code",
  detected: true,
  last_scan_at: null,
  project_count: 32,
  session_count: 177,
};

/**
 * Every step is driven by `useOnboarding` in the app; the stories pin one by
 * handing the component a ready-made state, which is also what keeps them from
 * firing real IPC in the browser.
 */
const state = (o: Partial<OnboardingState> = {}): OnboardingState => ({
  detected: [claudeCode],
  step: "detect",
  status: "Looking around…",
  progress: null,
  setupLine: null,
  failed: false,
  start: async () => {},
  addFolder: async () => {},
  ...o,
});

const meta = {
  title: "Components/Onboarding",
  component: Onboarding,
  args: { onDone: () => {}, state: state() },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div style={{ height: "100vh", background: "var(--win-bg)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Onboarding>;

export default meta;
type Story = StoryObj<typeof meta>;

/** First paint, while the harness probe is still in flight. */
export const Detecting: Story = {
  args: { state: state({ step: "detecting", detected: [] }) },
};

/** The probe came back with something installed. */
export const Detected: Story = {};

/** Mid-scan: the bar and the phase line both come from the scan events. */
export const Scanning: Story = {
  args: {
    state: state({
      step: "scanning",
      status: "Grading 27/48 files",
      progress: { done: 27, total: 48 },
    }),
  },
};

/** The payoff — what the scan found, and the way into Setup. */
export const Reveal: Story = {
  args: { state: state({
      step: "reveal",
      setupLine: "84 items across 9 projects · 3 never used · 1 erroring",
    }) },
};

/** Nothing on the machine looks like a supported harness. */
export const NoHarness: Story = {
  args: { state: state({ detected: [] }) },
};
