import type { FileRow, ProjectRow } from "@/lib/ipc";
import { populated } from "@/screens/Setup/setup.fixtures";

// Loaded data for the copy sweep: enough of every kind that each screen renders
// its populated copy (rows, findings, IssueActions, popovers), not its shell.

const ok = <T>(data: T) => Promise.resolve({ status: "ok" as const, data });

const FILE: FileRow = {
  id: "f-global",
  name: "CLAUDE.md",
  path: "/home/u/.claude/CLAUDE.md",
  project: "global",
  project_id: "/home/u",
  kind: "CLAUDE.md",
  grade: "C",
  score: 70,
  issue_count: 2,
  modified: null,
  worst_severity: "hi",
};

const PROJECT: ProjectRow = {
  id: "/code/web-app",
  name: "web-app",
  grade: "B",
  score: 80,
  file_count: 3,
  issue_count: 2,
  logo: null,
  modified: null,
  harness: "claude_code",
  session_count: 12,
  last_session_at: "2026-08-20T09:00:00.000Z",
  never_used_count: 1,
  error_count: 0,
  exists: true,
};

const DETAIL = {
  id: FILE.id,
  name: FILE.name,
  project: "global",
  path: FILE.path,
  grade: "C",
  score: 70,
  content: "# Style\n\nUse npm.\n",
  delta: null,
  dimensions: [
    { dimension: "Clarity", score: 50 },
    { dimension: "Consistency", score: 60 },
    { dimension: "Structure", score: 90 },
    { dimension: "Examples", score: 90 },
    { dimension: "Format", score: 90 },
  ],
  issues: [
    { line: 3, severity: "hi", source: "anthropic", title: "Wrong package manager", why: "Repo uses pnpm", fix_from: "npm", fix_to: "pnpm" },
    { line: null, severity: "lo", source: "custom", title: "No examples", why: "Add one", fix_from: null, fix_to: null },
  ],
};

const TREND = [
  { t: "1790000000", score: 70 },
  { t: "1790086400", score: 74 },
];

const RULES = [
  { id: "r1", title: "Wrong package manager", description: "Flags npm in a pnpm repo.", source: "anthropic", severity: "hi", enabled: true, custom: false, nl: false, pattern: "npm install", hit_count: 3 },
  { id: "r2", title: "State the output shape", description: "Ask for a shape.", source: "custom", severity: "lo", enabled: true, custom: true, nl: true, pattern: "State the output shape.", hit_count: 0 },
];

const TEMPLATES = [
  { id: "react-ts-claude", stack: "react-ts", file_type: "CLAUDE.md", title: "React + TypeScript — CLAUDE.md", description: "Role, pnpm commands and a worked example.", preview: "# CLAUDE.md — React\n\nYou are a senior engineer.\n" },
];

const USAGE_ROW = { kind: "skill", target: "adapt", uses: 4, sessions: 2, last_used: "2026-08-19T10:00:00.000Z", errors: 0 };

const results: Record<string, unknown> = {
  getSetup: populated,
  listFiles: [FILE],
  getFileDetail: DETAIL,
  listRules: RULES,
  listTemplates: TEMPLATES,
  getEntitlement: { paid: false, email: null, plan: null },
  getAiConfig: { provider: "none", model: "", has_key: false },
  hasBackup: false,
  getArtifactSource: { path: "/s/SKILL.md", content: "# Adapt\n\nAdapts designs.\n", bytes: 24, modified: "111", format: "markdown", editable: true },
  getOverview: {
    has_data: true, scan_folder: "/code", overall_grade: "B", overall_score: 80, file_count: 3, project_count: 1,
    critical: 1, warnings: 1, nits: 0, worklist: [], trend: TREND, trend_delta: 4, last_scan: "1790086400",
  },
  getAnalytics: {
    overall_score: 80, overall_grade: "B", overall_delta: 4, files_tracked: 3, project_count: 1, issues_fixed_total: 2,
    issues_fixed_auto: 1, issues_fixed_manual: 1, open_issues: 2, open_critical: 1, grade_distribution: [], trend: TREND, common_issues: [],
  },
  listProjects: [PROJECT],
  getUsageOverview: {
    window_days: 90, ranked: [USAGE_ROW], by_kind: [], sessions_per_project: [], mcp_error_rates: [],
  },
  getProjectUsage: { ranked: [USAGE_ROW], sessions_per_day: [] },
  getArtifactUsage: {
    window_days: 90, per_day: [], by_project: [], avg_turn_tokens: 1200,
  },
  getEffectiveRules: [],
  listHarnesses: populated.harnesses,
  getExtraScanFolders: ["/work/notes"],
  previewFolderRemoval: [],
  getSchedule: "off",
  getAlert: true,
  getAppStatus: { schema_version: 1, db_path: "/db", project_count: 1, file_count: 3 },
  scanNow: { files_scanned: 5, projects: 2, critical: 0, warnings: 0, nits: 0, overall_score: 90, overall_grade: "A" },
};

/** A stand-in for `commands`: named reads answer with the data above, anything else is a clean error. */
export const sweepCommands = new Proxy(
  {},
  {
    get: (_t, name: string) => () => {
      // `list_templates` is the one read that answers with the bare list, not a result.
      if (name === "listTemplates") return Promise.resolve(results.listTemplates);
      return name in results ? ok(results[name]) : Promise.resolve({ status: "error" as const, error: `${name} is not part of the sweep` });
    },
  },
);
