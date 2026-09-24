import { Fragment, useId, useState } from "react";
import { Icon } from "@/components/Icon";
import { ArtifactFacts } from "../ArtifactFacts";
import { DETAILS } from "./ArtifactMeta.constants";
import type { ArtifactMetaProps } from "./ArtifactMeta.types";
import { metaSegments } from "./artifactMeta.util";
import "./ArtifactMeta.css";

/**
 * What the app knows about an artifact, in the space of one line: the reader
 * opened the sheet to read the file, so this has to answer "what is it, is it
 * healthy" at a glance and then get out of the way. The full facts are one
 * click away behind Details, not stacked above the text.
 *
 * A bad error rate is a word, a colour *and* an icon — colour never stands
 * alone (see `.impeccable.md`).
 */
export function ArtifactMeta({ artifact, scope, showDescription = true }: ArtifactMetaProps) {
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const segments = metaSegments(artifact, scope);

  return (
    <div className="am">
      <div className="am__row">
        <p className="am__line">
          {segments.map((segment, i) => (
            <Fragment key={segment.text}>
              {i > 0 && (
                <span className="am__sep" aria-hidden="true">
                  ·
                </span>
              )}
              {segment.tone ? (
                <span className="am__rate" data-tone={segment.tone}>
                  {segment.tone === "bad" && <Icon name="alert" size={11} />}
                  {segment.text}
                </span>
              ) : (
                <span>{segment.text}</span>
              )}
            </Fragment>
          ))}
        </p>
        <button
          type="button"
          className="tool-btn am__toggle"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((v) => !v)}
        >
          {DETAILS}
          <Icon name={open ? "chevronUp" : "chevronDown"} size={11} />
        </button>
      </div>
      {showDescription && artifact.description && (
        <p className="am__desc" title={artifact.description}>
          {artifact.description}
        </p>
      )}
      <div id={detailsId} className="am__details" hidden={!open}>
        {open && <ArtifactFacts artifact={artifact} scope={scope} showDescription={false} />}
      </div>
    </div>
  );
}
