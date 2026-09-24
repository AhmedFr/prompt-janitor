import type { ArtifactFactsProps } from "./ArtifactFacts.types";
import { factsFor } from "./artifactFacts.util";
import "./ArtifactFacts.css";

/** What the inventory knows about an artifact, above the file itself. */
export function ArtifactFacts({ artifact, scope, showDescription }: ArtifactFactsProps) {
  return (
    <dl className="af">
      {factsFor(artifact, scope, { showDescription }).map(([label, value]) => (
        <div className="af__row" key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
