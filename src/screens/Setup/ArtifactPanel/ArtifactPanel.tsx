import { useArtifactSource } from "../useArtifactSource";
import type { ArtifactPanelProps } from "./ArtifactPanel.types";
import { ArtifactPanelView } from "./ArtifactPanelView";

/** Joins an artifact's source read to the read-only sheet that draws it. */
export function ArtifactPanel(props: ArtifactPanelProps) {
  const source = useArtifactSource(props.artifact.id);
  return <ArtifactPanelView {...props} source={source} />;
}
