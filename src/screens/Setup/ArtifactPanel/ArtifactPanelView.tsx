import { useState } from "react";
import { FileViewer } from "@/components/FileViewer";
import { Sheet, SheetPath } from "@/components/Sheet";
import { KIND_NAME } from "../ArtifactFacts";
import { ArtifactMeta } from "../ArtifactMeta";
import { FileActions } from "../FileActions";
import type { ArtifactPanelViewProps } from "./ArtifactPanel.types";

/**
 * Any non-skill artifact, read-only, as a file viewer: one line of what the
 * app knows about it, the path with what can be done to the file, and then
 * the file. For a hook, an MCP server or a settings file the file is the
 * backend's redacted excerpt, so nothing here has to know which values are
 * secret — and Copy copies the excerpt, never the raw config.
 *
 * A failed read is drawn inside the viewer, with a retry; a failed action
 * (Reveal, Open, Copy) is pinned to the sheet, over a file that is still fine.
 */
export function ArtifactPanelView({ artifact, scope, source, onClose }: ArtifactPanelViewProps) {
  const [actionError, setActionError] = useState<string | null>(null);
  const readFailed = source.content === null ? source.error : null;

  return (
    <Sheet
      title={artifact.name}
      ariaLabel={`${artifact.name} — ${KIND_NAME[artifact.kind]}`}
      onClose={onClose}
      size="wide"
      flush
      subtitle={<ArtifactMeta artifact={artifact} scope={scope} />}
      toolbar={
        <SheetPath
          path={source.path ?? artifact.path}
          actions={<FileActions artifactId={artifact.id} content={source.content} onError={setActionError} />}
        />
      }
      error={actionError}
    >
      <FileViewer
        name={artifact.name}
        content={source.content}
        format={source.format}
        path={source.path}
        loading={source.loading}
        error={readFailed}
        onRetry={source.reload}
      />
    </Sheet>
  );
}
