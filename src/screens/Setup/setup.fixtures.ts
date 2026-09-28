import type { ArtifactView, SetupView, UsageStat } from "@/lib/ipc";

// Shared by the Setup screen's test files, so the table and the sheets it opens read one inventory.

export const usage = (o: Partial<UsageStat> = {}): UsageStat => ({
  total: 9,
  sessions: 4,
  last_used: "2026-08-19T10:00:00.000Z",
  error_rate: 0,
  avg_turn_tokens: null,
  count_30d: 2,
  count_prev_30d: 1,
  ...o,
});

export const artifact = (o: Partial<ArtifactView> = {}): ArtifactView => ({
  id: 1,
  harness: "claude_code",
  layer: "global",
  kind: "rule",
  name: "a",
  path: "/a.md",
  plugin_name: null,
  description: null,
  bytes: 10,
  grade: null,
  score: null,
  file_id: null,
  issue_count: null,
  worst_severity: null,
  usage: null,
  ...o,
});

/** Every kind (no commands), global and project rows, two plugins, one missing project. */
export const populated: SetupView = {
  harnesses: [
    {
      id: "claude_code",
      display_name: "Claude Code",
      detected: true,
      last_scan_at: "2026-08-20T09:00:00.000Z",
      project_count: 2,
      session_count: 177,
    },
  ],
  global: [
    artifact({
      id: 1,
      kind: "rule",
      name: "global-style",
      path: "/home/u/.claude/CLAUDE.md",
      grade: "B",
      file_id: "f-global",
    }),
    artifact({
      id: 2,
      kind: "skill",
      name: "adapt",
      description: "Adapts designs across screen sizes",
      path: "/home/u/.claude/skills/adapt/SKILL.md",
      usage: usage({ total: 20, avg_turn_tokens: 300 }),
    }),
    artifact({
      id: 3,
      kind: "skill",
      name: "sunset",
      path: "/home/u/.claude/skills/sunset/SKILL.md",
      usage: null,
    }),
    artifact({
      id: 4,
      kind: "skill",
      name: "brainstorming",
      layer: "plugin",
      plugin_name: "superpowers",
      path: "/home/u/.claude/plugins/superpowers/skills/brainstorming/SKILL.md",
      usage: null,
    }),
    artifact({
      id: 5,
      kind: "agent",
      name: "code-reviewer",
      layer: "plugin",
      plugin_name: "superpowers",
      path: "/home/u/.claude/plugins/superpowers/agents/code-reviewer.md",
      usage: null,
    }),
    artifact({
      id: 6,
      kind: "mcp_server",
      name: "linear",
      path: "/home/u/.claude/mcp/linear",
      usage: usage({ error_rate: 0.5, avg_turn_tokens: 9000 }),
    }),
    artifact({ id: 7, kind: "hook", name: "PreToolUse: fmt", path: "/home/u/.claude/settings.json" }),
    artifact({
      id: 8,
      kind: "plugin",
      name: "superpowers",
      layer: "plugin",
      plugin_name: "superpowers",
      description: "v6.3.0 · claude-plugins-official",
      path: "/home/u/.claude/plugins/superpowers",
    }),
    artifact({
      id: 15,
      kind: "plugin",
      name: "posthog",
      layer: "plugin",
      plugin_name: "posthog",
      description: "v2.1.0 · posthog-marketplace",
      path: "/home/u/.claude/plugins/posthog",
    }),
    // Same skill name as superpowers' — only the plugin it came from tells
    // the two rows apart.
    artifact({
      id: 16,
      kind: "skill",
      name: "brainstorming",
      layer: "plugin",
      plugin_name: "posthog",
      path: "/home/u/.claude/plugins/posthog/skills/brainstorming/SKILL.md",
      usage: null,
    }),
    artifact({
      id: 17,
      kind: "settings",
      name: "settings.json",
      path: "/home/u/.claude/settings.json",
      bytes: 512,
    }),
  ],
  projects: [
    {
      harness: "claude_code",
      path: "/repo/web",
      name: "web",
      exists: true,
      session_count: 12,
      last_session_at: "2026-08-19T08:00:00.000Z",
      artifacts: [
        artifact({
          id: 9,
          layer: "project",
          kind: "rule",
          name: "web-rules",
          path: "/repo/web/CLAUDE.md",
          grade: "C",
          file_id: "f-web",
        }),
        artifact({
          id: 10,
          layer: "project",
          kind: "skill",
          name: "deploy",
          path: "/repo/web/.claude/skills/deploy/SKILL.md",
          usage: usage({ total: 30, avg_turn_tokens: 300 }),
        }),
      ],
    },
    {
      harness: "claude_code",
      path: "/repo/gone",
      name: "gone",
      exists: false,
      session_count: 1,
      last_session_at: "2026-07-01T08:00:00.000Z",
      artifacts: [],
    },
  ],
};

/** A scan that found no harness at all. */
export const noHarness: SetupView = {
  harnesses: [
    {
      id: "claude_code",
      display_name: "Claude Code",
      detected: false,
      last_scan_at: null,
      project_count: 0,
      session_count: 0,
    },
  ],
  global: [],
  projects: [],
};
