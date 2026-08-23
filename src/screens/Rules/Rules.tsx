import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Icon } from "@/components/Icon";
import { DataTable, type DataTableSearch } from "@/components/DataTable";
import { Tabs, useTabState } from "@/components/Tabs";
import type { RuleInfo } from "@/lib/ipc";
import { buildPills, columnsFor, DEFAULT_SORT, rowsByTab, tabItems, type RuleColumnsCtx } from "./rules.columns";
import {
  ADD_RULE_LABEL,
  AI_NOTE_NO_PROVIDER,
  AI_NOTE_READY,
  COPY_FAILED,
  COPY_OK,
  EMPTY_HINT,
  EMPTY_TITLE,
  FAILED_BODY,
  FAILED_RETRY,
  FAILED_TITLE,
  HIGHLIGHT_KEY,
  IMPORT_PACK_LABEL,
  SEARCH_PLACEHOLDER,
  STATUS_MSG_MS,
  TAB_IDS,
  TAB_LABELS,
  TAB_STATE_KEY,
  TABLE_STATE_PREFIX,
} from "./Rules.constants";
import type { RulesProps, RuleTabId } from "./Rules.types";
import { useRules } from "./useRules";
import "./Rules.css";

/**
 * Shared by every render that has no rules yet, and frozen because of it: a
 * caller that pushed into it would populate all of them. Typed mutable so it
 * can stand in for a real row set (`DataTable` takes `Row[]`).
 */
const NO_ROWS = Object.freeze([] as RuleInfo[]) as RuleInfo[];

/** A row is its rule: the id is unique across every pack and every custom rule. */
const rowId = (row: RuleInfo) => row.id;

/**
 * Identity-stable, which is what `DataTable`'s memoised filtering asks of it.
 * The pattern is searched as well as the name and description — it is the one
 * part of a rule no column prints, and "which rule bans this word?" is the
 * question the box gets asked.
 */
const SEARCH: DataTableSearch<RuleInfo> = {
  placeholder: SEARCH_PLACEHOLDER,
  keys: ["title", "description", (r) => r.pattern ?? ""],
};

/** The one row `/rules/new` asked us to land on, consumed on the way past. */
function takeHighlight(): string | undefined {
  try {
    return window.sessionStorage.getItem(HIGHLIGHT_KEY) ?? undefined;
  } catch {
    // Storage access denied (private-mode restrictions) — no highlight, no harm.
    return undefined;
  }
}

function forgetHighlight(): void {
  try {
    window.sessionStorage.removeItem(HIGHLIGHT_KEY);
  } catch {
    // Nothing to clean up if we could not read it in the first place.
  }
}

/** `active` comes back from `Tabs`/`useTabState` as a string; this narrows it without a cast. */
function asTab(id: string): RuleTabId {
  return TAB_IDS.find((candidate) => candidate === id) ?? TAB_IDS[0];
}

/**
 * Every rule the app enforces, as three comparable tables: what shipped, what
 * you wrote, and what your AI provider judges. Creating a rule is not here —
 * it is its own flow at `/rules/new`, so this screen stays about reading and
 * maintaining the set.
 */
export function Rules({ navigate, initialTab, rules: override }: RulesProps) {
  // The status line is built first because `useRules` writes into it: a failed
  // mutation and a finished copy are the same channel, so a failure expires
  // like everything else instead of sitting there for the rest of the session.
  const status = useStatusLine();
  const { say } = status;
  const state = useRules(say);
  const rules = override ?? state.rules;
  const loading = state.loading && !override;
  const failed = state.failed && !override;

  const byTab = useMemo(() => rowsByTab(rules), [rules]);
  const tabs = useMemo(() => tabItems(byTab), [byTab]);
  const [active, setActive] = useTabState(TAB_STATE_KEY, asTab(initialTab ?? ""), TAB_IDS);

  // A deep link names the tab it means; the remembered one only decides where
  // an unqualified visit lands. `useTabState` reads storage first, so without
  // this the link would lose to wherever the user last was.
  useEffect(() => {
    if (initialTab) setActive(initialTab);
  }, [initialTab, setActive]);

  // Read once, on mount, and dropped from storage immediately: a highlight is
  // about the trip the user just made, not about every later visit to Rules.
  const [highlight] = useState(takeHighlight);
  useEffect(() => {
    if (highlight) forgetHighlight();
  }, [highlight]);

  const { importPack, toggle, deleteRule } = state;

  const doImport = useCallback(async () => {
    const n = await importPack();
    if (n > 0) say(`Imported ${n} rule${n === 1 ? "" : "s"}`);
  }, [importPack, say]);

  const copy = useCallback(
    (pattern: string) => {
      // Guarded because a non-browser renderer (jsdom, Storybook's node pass)
      // has no clipboard — and a copy that quietly did nothing is worse than
      // one that says it could not.
      const written = navigator.clipboard?.writeText?.(pattern);
      if (!written) {
        say(COPY_FAILED);
        return;
      }
      written.then(() => say(COPY_OK)).catch(() => say(COPY_FAILED));
    },
    [say],
  );

  // Identity-stable so `columnsFor`'s per-`ctx` cache can hit; every callback
  // it closes over is stable, so this object is built once.
  const ctx = useMemo<RuleColumnsCtx>(
    () => ({
      // `void` is honest here and only here: `useRules` documents that none of
      // its actions reject — each reports its own failure through `error`.
      toggle: (id, enabled) => void toggle(id, enabled),
      onDelete: (id) => void deleteRule(id),
      onCopy: copy,
    }),
    [toggle, deleteRule, copy],
  );

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <h1 className="screen__title">Rules &amp; standards</h1>
      </header>

      <div className="scroll-area">
        <div className="page rules-page">
          {failed ? (
            <UnreadableRules onRetry={() => void state.refetch()} />
          ) : (
            <Tabs items={tabs} active={active} onChange={setActive} ariaLabel="Rule kinds">
              {(id) => {
                const tab = asTab(id);
                return (
                  <>
                    {tab === "ai" && (
                      <p className="rules-note">{state.aiReady ? AI_NOTE_READY : AI_NOTE_NO_PROVIDER}</p>
                    )}
                    <RuleTable
                      tab={tab}
                      rows={byTab.get(tab) ?? NO_ROWS}
                      ctx={ctx}
                      loading={loading}
                      highlight={highlight}
                      toolbarRight={
                        <>
                          {/* Always present, empty or not: a live region that
                              appears only once it has something to say has
                              nothing for assistive tech to be watching. Copy
                              results and failed writes share it, so the most
                              recent thing that happened is what it reads. */}
                          <span className="rules-status" role="status">
                            {status.message ?? ""}
                          </span>
                          {tab === "builtin" && (
                            <Button size="sm" onClick={() => void doImport()}>
                              <Icon name="plus" /> {IMPORT_PACK_LABEL}
                            </Button>
                          )}
                          <Button variant="primary" size="sm" onClick={() => navigate("rules-new", tab)}>
                            <Icon name="plus" /> {ADD_RULE_LABEL}
                          </Button>
                        </>
                      }
                    />
                  </>
                );
              }}
            </Tabs>
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * A transient sentence in the toolbar's live region, cleared after
 * {@link STATUS_MSG_MS}. The timer is owned rather than fired and forgotten:
 * one that outlives the screen sets state on an unmounted component, and one
 * that isn't reset lets an old message cut a new one short.
 */
function useStatusLine(): { message: string | null; say: (message: string) => void } {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const say = useCallback((next: string) => {
    setMessage(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), STATUS_MSG_MS);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return { message, say };
}

/**
 * One tab's table. Rendered by the tab panel, so a tab switch changes this
 * component's props rather than remounting it — which is what `DataTable`'s
 * `stateKey` handling expects: each tab keeps its own search, pills and sort
 * under `pj.table.rules.<tab>`.
 */
function RuleTable({
  tab,
  rows,
  ctx,
  loading,
  highlight,
  toolbarRight,
}: {
  tab: RuleTabId;
  rows: RuleInfo[];
  ctx: RuleColumnsCtx;
  loading: boolean;
  highlight?: string;
  toolbarRight: ReactNode;
}) {
  // Rebuilt only when a tab's row set changes — the source chips are derived
  // from the rows themselves.
  const pills = useMemo(() => buildPills(rows), [rows]);

  return (
    <DataTable
      ariaLabel={`${TAB_LABELS[tab]} rules`}
      stateKey={TABLE_STATE_PREFIX + tab}
      columns={columnsFor(ctx)}
      rows={rows}
      rowId={rowId}
      search={SEARCH}
      pills={pills}
      defaultSort={DEFAULT_SORT}
      highlightRowId={highlight}
      toolbarRight={toolbarRight}
      loading={loading}
      density="compact"
      empty={{ title: EMPTY_TITLE[tab], hint: EMPTY_HINT[tab] }}
    />
  );
}

/** The query failed — say so rather than showing an empty table, and offer the one retry there is. */
function UnreadableRules({ onRetry }: { onRetry: () => void }) {
  return (
    <Card padded>
      <div className="rules-panel">
        <h2 className="rules-panel__title">{FAILED_TITLE}</h2>
        <p className="muted rules-panel__body">{FAILED_BODY}</p>
        <Button onClick={onRetry}>
          <Icon name="refresh" /> {FAILED_RETRY}
        </Button>
      </div>
    </Card>
  );
}
