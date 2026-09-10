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
  // What a confirmed discard should do: leave the editor, or close the panel
  // outright. Null means nothing is being confirmed. Holding the *intent*
  // rather than a boolean is what lets Cancel and Close share one dialog
  // without either of them doing the other's job.
  const [pendingDiscard, setPendingDiscard] = useState<"stop-editing" | "close" | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Whatever had focus when the panel opened — the table row, in the app.
  const opener = useRef<HTMLElement | null>(null);

  const dirty = mode === "edit" && source.content !== null && draft !== source.content;

  // Focus moves into the panel on open so Escape and Tab land here rather than
  // in the table behind it, and goes back where it came from on close —
  // otherwise it lands on `<body>` and the keyboard user loses their place in
  // a table they may have scrolled a long way down.
  useEffect(() => {
    opener.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    return () => opener.current?.focus();
  }, []);

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
            return;
          }
          // `aria-modal` claims the rest of the page is inert, so Tab has to
          // behave that way too. Without this, Tab walks into the table behind
          // the scrim — which cannot be clicked, and from which Escape (bound
          // here) no longer reaches this handler.
          if (e.key === "Tab") trapTab(e, panelRef.current);
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
          {/* `requestClose`, not `onClose`: this is the most obvious way out
              of the panel, so it is the one that must not discard a draft
              silently. */}
          <button className="sp__close" onClick={requestClose} aria-label="Close">
            <Icon name="x" size={15} />
          </button>
        </header>

        {source.path && (
          <div className="sp__path">
            <span className="path" title={source.path}>
              {source.path}
            </span>
            {/* "Open", not "Reveal": this is the opener plugin, the same
                call the table's own action makes, and it opens the file in
                the default app rather than selecting it in Finder. */}
            <Button
              size="sm"
              aria-label={`Open ${skill.name} on disk`}
              onClick={() => void openExternal(source.path!)}
            >
              <Icon name="folder" /> Open
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
              <Button size="sm" disabled={source.saving} onClick={requestStopEditing}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" disabled={source.saving} onClick={() => void handleSave()}>
                {source.saving ? "Saving…" : "Save"}
              </Button>
            </>
          )}
        </footer>

        {pendingDiscard && (
          <DiscardConfirm
            onKeep={() => setPendingDiscard(null)}
            onDiscard={pendingDiscard === "close" ? onClose : stopEditing}
          />
        )}
      </div>
    </div>
  );
}

/** Everything inside the panel that can hold focus, in document order. */
const FOCUSABLE = 'button:not([disabled]), textarea, a[href], [tabindex]:not([tabindex="-1"])';

/** Wraps Tab and Shift+Tab around the panel's own focusable elements. */
function trapTab(e: React.KeyboardEvent, panel: HTMLElement | null) {
  const stops = panel ? [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
  if (stops.length === 0) return;

  const first = stops[0];
  const last = stops[stops.length - 1];
  const active = document.activeElement;
  // The panel itself holds focus until the user Tabs off it, so an unknown
  // active element means "at the start" rather than "somewhere in the middle".
  if (e.shiftKey ? active === first || !stops.includes(active as HTMLElement) : active === last) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  }
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
