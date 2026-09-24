import { useState } from "react";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Sheet, SheetPath } from "@/components/Sheet";
import { SourceViewer } from "@/components/SourceViewer";
import { ArtifactFacts } from "../ArtifactFacts";
import {
  DIRTY_LABEL,
  DISCARD_BODY,
  DISCARD_TITLE,
  EDITOR_LABEL,
  EMPTY_BODY,
  LOADING,
} from "./SkillPanel.constants";
import type { PanelMode, SkillPanelViewProps } from "./SkillPanel.types";
import "./SkillPanel.css";

/**
 * The skill sheet's editing flow, with the file handed in rather than
 * loaded. The frame (focus, Escape, Tab trap, backdrop) is `Sheet`'s and the
 * read view is `SourceViewer`'s; what is left here is read ↔ edit.
 *
 * Presentational on purpose, the way `TemplatePicker` is: `SkillPanel` owns
 * the IO and this owns the pixels, which is what lets every state below have
 * a story — loading, read, edit, dirty, save-failed — without a Tauri runtime
 * to produce it.
 *
 * The panel edits the file *as written*: the editor holds the raw source,
 * frontmatter and all, and the save is a byte-for-byte write of what is in the
 * textarea. Read mode is the only thing that interprets anything — it splits
 * the header off to show as a strip and renders the rest as markdown. That
 * split is deliberate: a round trip through a renderer and back would rewrite
 * a file the harness has to keep parsing, and this app has no business
 * reformatting a skill it was only asked to show.
 *
 * `source.content` (what is on disk) and `draft` (what is in the editor) are
 * held apart so "dirty" is a comparison rather than a flag — there is no path
 * where a save forgets to clear it.
 */
export function SkillPanelView({ skill, scope, source, onClose, onSaved, initialMode = "read" }: SkillPanelViewProps) {
  const [mode, setMode] = useState<PanelMode>(initialMode);
  const [draft, setDraft] = useState(source.content ?? "");
  // What a confirmed discard should do: leave the editor, or close the panel
  // outright. Null means nothing is being confirmed. Holding the *intent*
  // rather than a boolean is what lets Cancel and Close share one dialog
  // without either of them doing the other's job.
  const [pendingDiscard, setPendingDiscard] = useState<"stop-editing" | "close" | null>(null);
  const dirty = mode === "edit" && source.content !== null && draft !== source.content;

  /** Leaves the editor, keeping the panel open. */
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

  return (
    // `requestClose`, not `onClose`: every way out of the sheet — the close
    // button, Escape, the backdrop — must stop at the discard confirm first.
    <Sheet
      title={skill.name}
      ariaLabel={`${skill.name} — skill source`}
      onClose={requestClose}
      toolbar={source.path ? <SheetPath path={source.path} name={skill.name} /> : undefined}
      error={source.error}
      footer={
        mode === "read" ? (
          <Button size="sm" disabled={source.content === null || !source.editable} onClick={startEditing}>
            <Icon name="wand" /> Edit
          </Button>
        ) : (
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
        )
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
      {/* No description here: the frontmatter strip below is where the file
          itself keeps it — printing the indexed copy as well would show the
          same sentence twice, and a stale one whenever the file has been
          edited since the last scan. */}
      {mode === "read" && <ArtifactFacts artifact={skill} scope={scope} showDescription={false} />}
      {source.loading ? (
        <p className="muted sp__state">{LOADING}</p>
      ) : mode === "edit" ? (
        <textarea
          className="sp__editor"
          aria-label={EDITOR_LABEL}
          value={draft}
          spellCheck={false}
          onChange={(e) => setDraft(e.target.value)}
        />
      ) : source.content !== null ? (
        <SourceViewer content={source.content} format={source.format ?? "markdown"} emptyBody={EMPTY_BODY} />
      ) : null}
    </Sheet>
  );
}

/**
 * In-panel rather than `window.confirm`: a native dialog blocks the whole
 * webview, and this one has to be reachable by the same tests and the same
 * keyboard as the panel it guards.
 */
function DiscardConfirm({ onKeep, onDiscard }: { onKeep: () => void; onDiscard: () => void }) {
  return (
    <div className="sp__confirm" role="alertdialog" aria-label={DISCARD_TITLE}>
      <div className="sp__confirm-card">
        <h3 className="sp__confirm-title">{DISCARD_TITLE}</h3>
        <p className="muted sp__confirm-body">{DISCARD_BODY}</p>
        <div className="sp__confirm-actions">
          <Button size="sm" onClick={onKeep}>
            Keep editing
          </Button>
          <Button variant="primary" size="sm" onClick={onDiscard}>
            Discard
          </Button>
        </div>
      </div>
    </div>
  );
}
