import { Sheet, SheetPath } from "@/components/Sheet";
import { SourceViewer } from "@/components/SourceViewer";
import { ArtifactFacts, KIND_NAME } from "../ArtifactFacts";
import { LOADING } from "./ArtifactPanel.constants";
import type { ArtifactPanelViewProps } from "./ArtifactPanel.types";

/**
 * Any non-skill artifact, read-only: what the inventory knows about it, then
 * its source. For a hook, an MCP server or a settings file the source is the
 * backend's redacted excerpt, so nothing here has to know which values are
 * secret.
 */
export function ArtifactPanelView({ artifact, scope, source, onClose }: ArtifactPanelViewProps) {
  const kind = KIND_NAME[artifact.kind];
  return (
    <Sheet
      title={artifact.name}
      ariaLabel={`${artifact.name} — ${kind}`}
      onClose={onClose}
      subtitle={kind}
      toolbar={<SheetPath path={source.path ?? artifact.path} name={artifact.name} />}
      error={source.error}
    >
      <ArtifactFacts artifact={artifact} scope={scope} />
      {source.loading ? (
        <p className="muted">{LOADING}</p>
      ) : source.content !== null && source.format !== null ? (
        <SourceViewer content={source.content} format={source.format} />
      ) : null}
    </Sheet>
  );
}
