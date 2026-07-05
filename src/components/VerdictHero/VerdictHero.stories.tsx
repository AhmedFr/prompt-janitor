import type { Meta, StoryObj } from "@storybook/react";
import type { Overview } from "@/lib/ipc";
import { VerdictHero } from "./VerdictHero";
import type { VerdictData } from "./VerdictHero.types";

const overview: Overview = {
  has_data: true,
  scan_folder: "~/code",
  overall_grade: "C",
  overall_score: 71,
  file_count: 14,
  project_count: 6,
  critical: 3,
  warnings: 5,
  nits: 4,
  worklist: [],
  trend: [64, 66, 66, 69, 71],
  trend_delta: 7,
  last_scan: null,
};

const verdict: VerdictData = {
  fixPath: [
    { fileId: "f1", fileName: "CLAUDE.md", title: "References a deprecated model", severity: "hi", points: 15 },
    { fileId: "f2", fileName: "AGENTS.md", title: "Contradictory instructions", severity: "hi", points: 15 },
    { fileId: "f1", fileName: "CLAUDE.md", title: "Missing output format", severity: "mid", points: 7 },
  ],
  projectedGrade: "B",
  fixesToA: 6,
  autofixCount: 4,
  detStandards: 5,
  totalStandards: 30,
  entitled: false,
  aiReady: false,
  loading: false,
};

const meta = {
  title: "Components/VerdictHero",
  component: VerdictHero,
  args: {
    data: overview,
    verdict,
    scanning: false,
    autoFixBusy: false,
    onScanNow: () => {},
    onAutoFix: () => {},
    navigate: () => {},
  },
} satisfies Meta<typeof VerdictHero>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Free tier, no AI provider: locked Auto-fix + partial standards coverage. */
export const Default: Story = {};

/** Paid tier with a provider: unlocked Auto-fix, full catalog coverage. */
export const ProWithProvider: Story = {
  args: { verdict: { ...verdict, entitled: true, aiReady: true } },
};

/** One good fix away from the bar. */
export const GradeB: Story = {
  args: {
    data: { ...overview, overall_grade: "B", overall_score: 86, critical: 1, warnings: 2, nits: 1 },
    verdict: {
      ...verdict,
      fixesToA: 1,
      fixPath: [verdict.fixPath[0]],
      projectedGrade: "A",
      autofixCount: 1,
    },
  },
};

/** Everything already meets the bar. */
export const GradeA: Story = {
  args: {
    data: { ...overview, overall_grade: "A", overall_score: 96, critical: 0, warnings: 1, nits: 2 },
    verdict: { ...verdict, fixPath: [], projectedGrade: null, fixesToA: 0, autofixCount: 0 },
  },
};

/** Failing outright. */
export const GradeF: Story = {
  args: {
    data: { ...overview, overall_grade: "F", overall_score: 34, critical: 9, warnings: 8, nits: 6 },
    verdict: { ...verdict, projectedGrade: "D", fixesToA: 14, autofixCount: 7 },
  },
};
