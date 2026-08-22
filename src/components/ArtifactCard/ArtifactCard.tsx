import type { ArtifactCardProps } from "./ArtifactCard.types";
import { KIND_ICON, KIND_LABEL } from "./ArtifactCard.constants";
import { Icon } from "@/components/Icon";
import { Grade, type GradeLetter } from "@/components/Grade";
import { UsageBadge } from "@/components/UsageBadge";
import "./ArtifactCard.css";

/** One row in the setup inventory: what an artifact is, whether it's graded, and how it's used. */
export function ArtifactCard({ artifact, onOpen }: ArtifactCardProps) {
  const { kind, name, description, layer, plugin_name, grade, usage } = artifact;

  const body = (
    <>
      <span className="artifact-card__kind">
        <Icon name={KIND_ICON[kind]} size={14} />
        {KIND_LABEL[kind]}
      </span>
      <span className="artifact-card__main">
        <span className="artifact-card__title-row">
          <span className="artifact-card__name">{name}</span>
          {layer === "plugin" && plugin_name && (
            <span className="artifact-card__plugin">{plugin_name}</span>
          )}
        </span>
        {description && <span className="artifact-card__description">{description}</span>}
      </span>
      <span className="artifact-card__meta">
        {/* DB only writes A–F; IPC type is a loose string. */}
        {kind === "rule" && grade && <Grade grade={grade as GradeLetter} size="sm" />}
        <UsageBadge usage={usage} />
      </span>
    </>
  );

  if (kind === "rule" && artifact.file_id) {
    const fileId = artifact.file_id;
    return (
      <button type="button" className="artifact-card" onClick={() => onOpen?.(fileId)}>
        {body}
      </button>
    );
  }

  return <div className="artifact-card">{body}</div>;
}
