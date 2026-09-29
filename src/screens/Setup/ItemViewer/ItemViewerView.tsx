import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { FileViewer } from "@/components/FileViewer";
import { Icon } from "@/components/Icon";
import { Sheet, SheetPath } from "@/components/Sheet";
import { useBackGuard } from "@/App/navigation/NavigationContext";
import { KIND_NAME } from "../ArtifactFacts";
import { ArtifactMeta } from "../ArtifactMeta";
import { FileActions } from "../FileActions";
import { Findings } from "../Findings";
import { ItemUsage } from "../ItemUsage";
import { DiscardConfirm } from "./DiscardConfirm";
import { DIRTY_LABEL, EDITOR_LABEL, EMPTY_BODY } from "./ItemViewer.constants";
import type { ItemViewerViewProps, PanelMode } from "./ItemViewer.types";
import { ItemViewerTabs } from "./ItemViewerTabs";
import { StepButtons } from "./StepButtons";
import { useStepKeys } from "./useStepKeys";
import "./ItemViewer.css";

/**
 * The item sheet: Content (the file viewer, plus read ↔ edit where the backend
 * accepts a save), Findings and Usage, with ⌘↑/⌘↓ stepping through the rows on
 * screen. The frame (focus, Escape, Tab trap, backdrop) is `Sheet`'s and the
 * reading is `FileViewer`'s; what is left here is the tabs and the editing flow.
 *
 * Presentational on purpose: `ItemViewer` owns the IO and this owns the
 * pixels, which is what lets every state — loading, read, edit, dirty,
 * save-failed — have a story without a Tauri runtime to produce it.
 *
 * The viewer edits the file *as written*: the editor holds the raw source,
 * frontmatter and all, and the save is a byte-for-byte write of the textarea.
 *
 * `source.content` (what is on disk) and `draft` (what is in the editor) are
 * held apart so "dirty" is a comparison rather than a flag — there is no path
 * where a save forgets to clear it.
 */
export function ItemViewerView({
  item,
  scope,
  source,
  tab,
  onTab,
  onClose,
  onStep,
  onSaved,
  loadedIn,
  onSelectProject,
  initialMode = "read",
  findings,
  usage,
}: ItemViewerViewProps) {
  const [mode, setMode] = useState<PanelMode>(initialMode);
  const [draft, setDraft] = useState(source.content ?? "");
  const [actionError, setActionError] = useState<string | null>(null);
  // The line a finding's link asked to see; forces the Source view (Task 3.4).
  const [focusLine, setFocusLine] = useState<number | null>(null);
  // What a confirmed discard should do: leave the editor, or close the viewer
  // outright. Null means nothing is being confirmed.
  const [pendingDiscard, setPendingDiscard] = useState<"stop-editing" | "close" | null>(null);
  const dirty = mode === "edit" && source.content !== null && draft !== source.content;
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Edit is a request to type, so the cursor goes straight into the file.
  useEffect(() => {
    if (mode === "edit") editorRef.current?.focus();
  }, [mode]);

  // A line link belongs to the item it was clicked on.
  useEffect(() => setFocusLine(null), [item.id]);
  // …and to the one visit to Content it asked for: Content remounts the file
  // viewer on every return, and a line still held here would force Source again.
  useEffect(() => {
    if (tab !== "content") setFocusLine(null);
  }, [tab]);

  // Not while editing: the textarea keeps its caret moves, and a step would
  // throw the draft away.
  useStepKeys(onStep, mode !== "edit");

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

  // Back unmounts the viewer without passing through the sheet, so while a
  // draft is unsaved it asks here first, like every other way out.
  useBackGuard(dirty, requestClose);

  /** Cancel means "stop editing", not "stop looking at this item". */
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

  const jumpToLine = (line: number) => {
    setFocusLine(line);
    onTab("content");
  };

  // A fix rewrote the file: re-read it, so Content shows the fixed text and a
  // later save carries the new stamp instead of being refused as a conflict.
  const fixLanded = () => {
    source.reload();
    onSaved?.();
  };

  const canEdit = mode === "read" && source.editable && source.content !== null && tab === "content";
  const target = item.origin === "graded" && item.file_id ? { fileId: item.file_id } : { artifactId: item.id };

  return (
    // `requestClose`, not `onClose`: every way out of the sheet — the close
    // button, Escape, the backdrop — must stop at the discard confirm first.
    <Sheet
      title={item.name}
      ariaLabel={`${item.name} — ${KIND_NAME[item.kind]}`}
      onClose={requestClose}
      size="wide"
      flush
      // A skill's description is the first thing in its frontmatter strip, and
      // the indexed copy goes stale the moment the file is edited here.
      subtitle={
        <ArtifactMeta
          artifact={item}
          scope={scope}
          showDescription={item.kind !== "skill"}
          loadedIn={loadedIn.length}
        />
      }
      toolbar={
        <SheetPath
          path={source.path ?? item.path}
          actions={
            <>
              <FileActions target={target} content={source.content} onError={setActionError} />
              {onStep && <StepButtons onStep={onStep} disabled={mode === "edit"} />}
            </>
          }
        />
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
      <ItemViewerTabs active={tab} onChange={onTab} findingsCount={item.issue_count} editing={mode === "edit"} />
      {tab === "content" && (
        <FileViewer
          name={item.name}
          content={source.content}
          format={source.format ?? (source.content !== null ? "markdown" : null)}
          path={source.path}
          loading={source.loading}
          error={readFailed}
          onRetry={source.reload}
          emptyBody={EMPTY_BODY}
          focusLine={focusLine}
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
      )}
      {tab === "findings" && (
        <div className="iv-panel">
          <Findings fileId={item.kind === "rule" ? item.file_id : null} onJumpToLine={jumpToLine} onChanged={fixLanded} findings={findings} />
        </div>
      )}
      {tab === "usage" && (
        <div className="iv-panel">
          <ItemUsage item={item} loadedIn={loadedIn} onSelectProject={onSelectProject} usage={usage} />
        </div>
      )}
    </Sheet>
  );
}
