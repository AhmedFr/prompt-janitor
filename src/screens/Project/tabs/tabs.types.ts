import type { ArtifactView, EffectiveRule, FileRow, ProjectUsage } from "@/lib/ipc";
import type { ColumnsCtx } from "@/screens/Setup/setup.columns";

export interface RulesTabProps {
  /** This project's scanned files, already narrowed by `project_id`. */
  files: FileRow[];
  /** Opens one file's Detail screen. Stable, so the table's memos hold. */
  onOpen: (fileId: string) => void;
}

export interface EffectiveRulesTabProps {
  rules: EffectiveRule[];
  /** The harness whose load order this is; `null` when none has worked here. */
  harness: string | null;
}

export interface SetupTabProps {
  artifacts: ArtifactView[];
  /** Identity-stable, which is what makes `projectSetupColumns`' cache hit. */
  ctx: ColumnsCtx;
}

export interface UsageTabProps {
  /** `null` when there is no harness to attribute usage to. */
  usage: ProjectUsage | null;
  harness: string | null;
}
