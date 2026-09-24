import { formatCount, formatPercent, NEVER_MARK, rateTone } from "@/components/DataTable";
import type { ArtifactView } from "@/lib/ipc";
import { INVOKED_KINDS, KIND_NAME, lastUsedLabel } from "../ArtifactFacts";
import { ERROR_RATE_BANDS } from "../Setup.constants";
import type { MetaSegment } from "./ArtifactMeta.types";

/**
 * The one line under a sheet's title: "Agent · web-app · 312 uses · 4% errors
 * · used 2h ago". Everything the facts table says that a reader needs before
 * the file, in the order they ask it — what is this, whose, is it used, does
 * it work. The rest (sessions, tokens per turn) waits behind Details.
 */
export function metaSegments(artifact: ArtifactView, scope: string): MetaSegment[] {
  const segments: MetaSegment[] = [{ text: KIND_NAME[artifact.kind] }, { text: scope }];

  if (artifact.grade) {
    segments.push({ text: artifact.score == null ? `Grade ${artifact.grade}` : `Grade ${artifact.grade} · ${artifact.score}` });
  }

  const usage = artifact.usage;
  if (usage) {
    segments.push({ text: `${formatCount(usage.total)} ${usage.total === 1 ? "use" : "uses"}` });
    if (usage.error_rate != null) {
      segments.push({ text: `${formatPercent(usage.error_rate)} errors`, tone: rateTone(usage.error_rate, ERROR_RATE_BANDS) });
    }
  }

  if (usage || INVOKED_KINDS.has(artifact.kind)) {
    const last = lastUsedLabel(usage?.last_used);
    segments.push({ text: last === NEVER_MARK ? "never used" : `used ${last}` });
  }
  return segments;
}
