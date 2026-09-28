import type { Meta, StoryObj } from "@storybook/react";
import { FoldersTabBody } from "./FoldersTab";
import type { HarnessInfo, ProjectRow } from "@/lib/ipc";
import "../Settings.css";

const noop = async () => {};

const detected: HarnessInfo[] = [
  {
    id: "claude_code",
    display_name: "Claude Code",
    detected: true,
    last_scan_at: "2026-08-20T09:00:00.000Z",
    project_count: 32,
    session_count: 177,
  },
];

const meta = {
  title: "Screens/Settings/FoldersTab",
  component: FoldersTabBody,
  args: {
    harnesses: detected,
    extraFolders: ["/Users/dev/code/scratch-prompts"],
    projects: [],
    scanning: false,
    scanProgress: { phase: null, progress: null, reset: () => {} },
    armed: null,
    addFolder: noop,
    askRemove: () => {},
    cancelRemove: () => {},
    confirmRemove: noop,
    rescan: noop,
  },
  decorators: [
    (Story) => (
      <div className="page" style={{ maxWidth: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FoldersTabBody>;

export default meta;
type Story = StoryObj<typeof meta>;

/** One detected harness with counts, plus an extra folder scanned alongside it. */
export const Detected: Story = {};

/** Nothing detected — the empty state that points at the Rules-free Add-folder path. */
export const NothingDetected: Story = {
  args: {
    harnesses: [
      { id: "cursor", display_name: "Cursor", detected: false, last_scan_at: null, project_count: 0, session_count: 0 },
    ],
    extraFolders: [],
  },
};

/** A scan in flight, showing the same progress bar Setup's Rescan draws. */
export const Scanning: Story = {
  args: {
    scanning: true,
    scanProgress: {
      phase: "files",
      progress: { done: 42, total: 177 },
      reset: () => {},
    },
  },
};

/** A folder's Remove button armed the confirmation, counting what it would delete. */
export const ArmedRemoval: Story = {
  args: {
    armed: "/Users/dev/code/scratch-prompts",
    projects: [
      { id: "/Users/dev/code/scratch-prompts/a", harness: null } as ProjectRow,
      { id: "/Users/dev/code/scratch-prompts/b", harness: null } as ProjectRow,
    ],
  },
};
