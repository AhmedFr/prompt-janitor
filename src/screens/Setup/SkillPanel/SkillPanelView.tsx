import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { FileViewer } from "@/components/FileViewer";
import { Icon } from "@/components/Icon";
import { Sheet, SheetPath } from "@/components/Sheet";
import { ArtifactMeta } from "../ArtifactMeta";
import { FileActions } from "../FileActions";
import { DiscardConfirm } from "./DiscardConfirm";
import { DIRTY_LABEL, EDITOR_LABEL, EMPTY_BODY } from "./SkillPanel.constants";
import type { PanelMode, SkillPanelViewProps } from "./SkillPanel.types";
import "./SkillPanel.css";

/**
 * The skill sheet: the same file viewer every artifact gets, plus read ↔ edit.
 * The frame (focus, Escape, Tab trap, backdrop) is `Sheet`'s and the reading is
 * `FileViewer`'s; what is left here is the editing flow.
 *
 * Presentational on purpose: `SkillPanel` owns the IO and this owns the
 * pixels, which is what lets every state — loading, read, edit, dirty,
 * save-failed — have a story without a Tauri runtime to produce it.
 *
 * The panel edits the file *as written*: the editor holds the raw source,
 * frontmatter and all, and the save is a byte-for-byte write of the textarea.
 * Only the Rendered view interprets anything, and a round trip through it is
 * never written back — this app has no business reformatting a skill.
 *
 * `source.content` (what is on disk) and `draft` (what is in the editor) are
 * held apart so "dirty" is a comparison rather than a flag — there is no path
 * where a save forgets to clear it.
 */
export function SkillPanelView({ skill, scope, source, onClose, onSaved, initialMode = "read" }: SkillPanelViewProps) {
  const [mode, setMode] = useState<PanelMode>(initialMode);
  const [draft, setDraft] = useState(source.content ?? "");
  const [actionError, setActionError] = useState<string | null>(null);
  // What a confirmed discard should do: leave the editor, or close the panel
  // outright. Null means nothing is being confirmed. Holding the *intent*
  // rather than a boolean is what lets Cancel and Close share one dialog
  // without either of them doing the other's job.
  const [pendingDiscard, setPendingDiscard] = useState<"stop-editing" | "close" | null>(null);
  const dirty = mode === "edit" && source.content !== null && draft !== source.content;
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Edit is a request to type, so the cursor goes straight into the file.
  useEffect(() => {
    if (mode === "edit") editorRef.current?.focus();
  }, [mode]);

  // A read that failed has no file to draw, so the viewer says why; a save that
  // failed sits over a file that is still there, so the sheet pins it.
  const readFailed = source.content === null ? source.error : null;
  const pinned = source.content !== null ? source.error : null;

  const stopEditing = () => {
    setMode("read");
    setPendingDiscard(null);
  };

  const requestClose = () => {
    if (dirty) {
      setPendingDiscard("close");
      return;
    }
    onClose();
  };

  /** Cancel means "stop editing", not "stop looking at this skill". */
  const requestStopEditing = () => {
    if (dirty) {
      setPendingDiscard("stop-editing");
      return;
    }
    stopEditing();
  };

  const startEditing = () => {
    setDraft(source.content ?? "");
    setMode("edit");
  };

  const handleSave = async () => {
    const saved = await source.save(draft);
    if (saved === null) return; // `source.error` now says why; stay in the editor.
    onSaved?.();
    setMode("read");
  };

  const canEdit = mode === "read" && source.editable && source.content !== null;

  return (
    // `requestClose`, not `onClose`: every way out of the sheet — the close
    // button, Escape, the backdrop — must stop at the discard confirm first.
    <Sheet
      title={skill.name}
      ariaLabel={`${skill.name} — skill source`}
      onClose={requestClose}
      size="wide"
      flush
      // No description on the line: the frontmatter, first thing in the viewer,
      // is where the file keeps it — and the indexed copy goes stale the moment
      // the file is edited here.
      subtitle={<ArtifactMeta artifact={skill} scope={scope} showDescription={false} />}
      toolbar={
        source.path ? (
          <SheetPath
            path={source.path}
            actions={<FileActions artifactId={skill.id} content={source.content} onError={setActionError} />}
          />
        ) : undefined
      }
      error={pinned ?? actionError}
      footer={
        mode === "edit" ? (
          <>
            {dirty && <span className="sp__dirty">{DIRTY_LABEL}</span>}
            <span className="toolbar-spacer" />
            <Button size="sm" disabled={source.saving} onClick={requestStopEditing}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={source.saving} onClick={() => void handleSave()}>
              {source.saving ? "Saving…" : "Save"}
            </Button>
          </>
        ) : undefined
      }
      overlay={
        pendingDiscard && (
          <DiscardConfirm
            onKeep={() => setPendingDiscard(null)}
            onDiscard={pendingDiscard === "close" ? onClose : stopEditing}
          />
        )
      }
    >
      <FileViewer
        name={skill.name}
        content={source.content}
        format={source.format ?? (source.content !== null ? "markdown" : null)}
        path={source.path}
        loading={source.loading}
        error={readFailed}
        onRetry={source.reload}
        emptyBody={EMPTY_BODY}
        actions={
          canEdit ? (
            <button type="button" className="tool-btn" onClick={startEditing}>
              <Icon name="wand" size={13} /> Edit
            </button>
          ) : undefined
        }
        editor={
          mode === "edit" ? (
            <textarea
              ref={editorRef}
              className="sp__editor"
              aria-label={EDITOR_LABEL}
              value={draft}
              spellCheck={false}
              onChange={(e) => setDraft(e.target.value)}
            />
          ) : undefined
        }
      />
    </Sheet>
  );
}
