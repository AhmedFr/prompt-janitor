import { KIND_SINGULAR } from "@/lib/vocabulary";

/** A kind as the header names it — see `@/lib/vocabulary`. */
export const KIND_NAME = KIND_SINGULAR;

/** The kinds the usage index can attribute an invocation to. */
export const INVOKED_KINDS: ReadonlySet<ArtifactKind> = new Set(["skill", "agent", "command", "mcp_server"]);
