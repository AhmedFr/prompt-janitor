import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { Markdown } from "@/components/Markdown";
import { openExternal } from "@/lib/open-external";
import {
  DIRTY_LABEL,
  DISCARD_BODY,
  DISCARD_TITLE,
  EDITOR_LABEL,
  EMPTY_BODY,
  LOADING,
} from "./SkillPanel.constants";
import type { PanelMode, SkillPanelViewProps } from "./SkillPanel.types";
import { splitFrontmatter } from "./skillPanel.util";
import "./SkillPanel.css";

/**
 * The panel's layout and interaction, with the file handed in rather than
 * loaded.
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
export function SkillPanelView({ skill, source, onClose, onSaved, initialMode = "read" }: SkillPanelViewProps) {
  const [mode, setMode] = useState<PanelMode>(initialMode);
  const [draft, setDraft] = useState(source.content ?? "");
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const dirty = mode === "edit" && source.content !== null && draft !== source.content;

  // Focus moves into the panel on open so Escape and Tab land here rather than
  // in the table behind it.
  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const requestClose = () => {
    if (dirty) {
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  };

  const startEditing = () => {
    setDraft(source.content ?? "");
    setMode("edit");
  };

  const handleSave = async () => {
    const bytes = await source.save(draft);
    if (bytes === null) return; // `source.error` now says why; stay in the editor.
    onSaved?.(bytes);
    setMode("read");
  };

  return (
    <div className="sp-scrim" onMouseDown={requestClose}>
      <div
        ref={panelRef}
        className="sp"
        role="dialog"
        aria-modal="true"
        aria-label={`${skill.name} — skill source`}
        tabIndex={-1}
        // The scrim closes on a click that started on the scrim; without this
        // a drag that ends outside the panel (selecting text to the edge)
        // would close it mid-selection.
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            requestClose();
          }
        }}
      >
        <header className="sp__hd">
          {/* Name only. The description lives in the frontmatter strip below,
              which is where the file itself keeps it — printing the indexed
              copy here as well would show the same sentence twice, and would
              show a stale one whenever the file has been edited since the
              last scan. */}
          <div className="sp__id">
            <h2 className="sp__title">{skill.name}</h2>
          </div>
          <button className="sp__close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </header>

        {source.path && (
          <div className="sp__path">
            <span className="path" title={source.path}>
              {source.path}
            </span>
            <Button size="sm" aria-label="Reveal in Finder" onClick={() => void openExternal(source.path!)}>
              <Icon name="folder" /> Reveal
            </Button>
          </div>
        )}

        <div className="sp__body">
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
            <ReadView source={source.content} />
          ) : null}
        </div>

        {source.error && (
          <p className="sp__error" role="alert">
            {source.error}
          </p>
        )}

        <footer className="sp__ft">
          {mode === "read" ? (
            <Button size="sm" disabled={source.content === null} onClick={startEditing}>
              <Icon name="wand" /> Edit
            </Button>
          ) : (
            <>
              {dirty && <span className="sp__dirty">{DIRTY_LABEL}</span>}
              <span className="toolbar-spacer" />
              <Button size="sm" disabled={source.saving} onClick={() => setMode("read")}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" disabled={source.saving} onClick={() => void handleSave()}>
                {source.saving ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </footer>

        {confirmingDiscard && (
          <DiscardConfirm onKeep={() => setConfirmingDiscard(false)} onDiscard={onClose} />
        )}
      </div>
    </div>
  );
}

/** The file's header as a key/value strip, then its body rendered as markdown. */
function ReadView({ source }: { source: string }) {
  const { fields, body } = splitFrontmatter(source);
  return (
    <>
      {fields.length > 0 && (
        <dl className="sp__meta">
          {fields.map(([key, value]) => (
            <div className="sp__meta-row" key={key}>
              <dt>{key}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {body.trim().length > 0 ? <Markdown source={body} /> : <p className="muted">{EMPTY_BODY}</p>}
    </>
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
