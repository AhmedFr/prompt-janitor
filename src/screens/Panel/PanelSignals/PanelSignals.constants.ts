import { plural } from "@/screens/Setup/setup.util";
import type { SignalSpec } from "./PanelSignals.types";

/**
 * The three usage signals phase 7 made measurable, in the order they cost the
 * user: things configured and never used, things used and failing, and how
 * much work went through the harness today.
 */
export const SIGNALS: SignalSpec[] = [
  {
    id: "never-used-skills",
    count: (counts) => counts.neverUsedSkills,
    text: (count) => plural(count, "never-used skill"),
    route: "setup",
    target: "skill",
    destination: "Setup",
    toned: true,
  },
  {
    id: "mcp-erroring",
    count: (counts) => counts.mcpErroring,
    text: (count) => `${plural(count, "MCP server")} erroring`,
    route: "setup",
    target: "mcp_server",
    destination: "Setup",
    toned: true,
  },
  {
    id: "sessions-today",
    count: (counts) => counts.sessionsToday,
    text: (count) => `${plural(count, "session")} today`,
    route: "analytics",
    target: null,
    destination: "Analytics",
    toned: false,
  },
];

/** "3 never-used skills — open Setup": the count and where it is dealt with. */
export const signalLabel = (text: string, destination: string) => `${text} — open ${destination}`;

/** Both problem counts are zero — said once, instead of two chips reporting nothing. */
export const ALL_CLEAR = "Setup looks clean";
