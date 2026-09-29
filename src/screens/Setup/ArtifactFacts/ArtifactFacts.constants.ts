import type { ArtifactKind } from "@/lib/ipc";
import { KIND_SINGULAR } from "@/lib/vocabulary";
import { USAGE_KINDS } from "../setup.unified";

/** A kind as the header names it — see `@/lib/vocabulary`. */
export const KIND_NAME = KIND_SINGULAR;

/** The kinds the usage index can attribute an invocation to. */
export const INVOKED_KINDS: ReadonlySet<ArtifactKind> = USAGE_KINDS;
