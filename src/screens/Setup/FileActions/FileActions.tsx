import { useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { copyText } from "@/lib/clipboard";
import { commands, isTauri, type OpenAction } from "@/lib/ipc";
import { COPIED, COPIED_MS, COPY, COPY_FAILED, OPEN, REVEAL } from "./FileActions.constants";
import type { FileActionsProps } from "./FileActions.types";

/**
 * What a reader does with a file once they have read it: copy it, find it,
 * edit it somewhere real.
 *
 * Reveal and Open go through `open_artifact` with the artifact's *id*, so the
 * backend picks the path from what the scan found — the webview never holds
 * a permission to open arbitrary paths. Copy takes the text on screen, which
 * for a config-derived kind is the redacted excerpt: a copied secret would
 * leak exactly what the viewer hid.
 */
export function FileActions({ artifactId, content, onError }: FileActionsProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    if (content === null) return;
    if (await copyText(content)) setCopied(true);
    else onError(COPY_FAILED);
  };

  const open = async (action: OpenAction) => {
    if (!isTauri) return;
    const result = await commands.openArtifact(artifactId, action);
    if (result.status === "error") onError(result.error);
  };

  return (
    <>
      <button
        type="button"
        className="tool-btn"
        aria-label={COPY.name}
        title={COPY.name}
        disabled={content === null}
        onClick={() => void copy()}
      >
        <Icon name={copied ? "check" : "copy"} size={13} />
        <span aria-live="polite">{copied ? COPIED : COPY.label}</span>
      </button>
      <button type="button" className="tool-btn" aria-label={REVEAL.name} title={REVEAL.name} onClick={() => void open("reveal")}>
        <Icon name="folder" size={13} /> {REVEAL.label}
      </button>
      <button type="button" className="tool-btn" aria-label={OPEN.name} title={OPEN.name} onClick={() => void open("open")}>
        <Icon name="external" size={13} /> {OPEN.label}
      </button>
    </>
  );
}
