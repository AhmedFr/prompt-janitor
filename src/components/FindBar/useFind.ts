import { useCallback, useEffect, useState, type RefObject } from "react";
import { CURRENT_HIGHLIGHT, MATCH_HIGHLIGHT } from "./FindBar.constants";
import { findRanges } from "./find.util";
import type { FindState } from "./FindBar.types";

/** The Custom Highlight API's registry, when the webview has one (Safari 17.2+). */
function highlightRegistry(): Map<string, unknown> | null {
  const css = (globalThis as { CSS?: { highlights?: Map<string, unknown> } }).CSS;
  const Ctor = (globalThis as { Highlight?: unknown }).Highlight;
  return css?.highlights && typeof Ctor === "function" ? css.highlights : null;
}

/**
 * Built empty and filled one range at a time: `new Highlight(...ranges)`
 * spreads every match into a single call, which throws once a one-letter query
 * in a long file passes the engine's argument limit.
 */
function paint(name: string, ranges: AbstractRange[]) {
  const registry = highlightRegistry();
  if (!registry) return;
  const Ctor = (globalThis as unknown as { Highlight: new () => { add: (r: AbstractRange) => unknown } }).Highlight;
  const highlight = new Ctor();
  for (const range of ranges) highlight.add(range);
  registry.set(name, highlight);
}

function unpaint() {
  const registry = highlightRegistry();
  registry?.delete(MATCH_HIGHLIGHT);
  registry?.delete(CURRENT_HIGHLIGHT);
}

/**
 * Find-in-file over whatever `container` currently shows.
 *
 * `contentKey` is what says the DOM under the container changed — the file,
 * or the Rendered/Source mode — since a ref's content changing re-renders
 * nothing. The search runs again whenever it or the query changes, and the
 * current match resets to the first.
 *
 * Matches are painted with the CSS Custom Highlight API, so nothing is ever
 * inserted into the DOM React owns; on a webview without it the count and the
 * scrolling still work.
 */
export function useFind(container: RefObject<HTMLElement | null>, query: string, contentKey: unknown): FindState {
  const [ranges, setRanges] = useState<AbstractRange[]>([]);
  const [current, setCurrent] = useState(-1);

  useEffect(() => {
    const root = container.current;
    const found = root ? findRanges(root, query) : [];
    setRanges(found);
    setCurrent(found.length > 0 ? 0 : -1);
  }, [container, query, contentKey]);

  useEffect(() => {
    if (ranges.length === 0) {
      unpaint();
      return;
    }
    paint(MATCH_HIGHLIGHT, ranges);
    paint(CURRENT_HIGHLIGHT, current >= 0 ? [ranges[current]] : []);
    // Centred, so the lines around the match are visible too; `?.` because
    // jsdom has no layout and so no `scrollIntoView`.
    ranges[current]?.startContainer.parentElement?.scrollIntoView?.({ block: "center" });
  }, [ranges, current]);

  useEffect(() => unpaint, []);

  const next = useCallback(() => {
    setCurrent((at) => (ranges.length === 0 ? -1 : (at + 1) % ranges.length));
  }, [ranges]);

  const prev = useCallback(() => {
    setCurrent((at) => (ranges.length === 0 ? -1 : (at - 1 + ranges.length) % ranges.length));
  }, [ranges]);

  return { count: ranges.length, current, next, prev };
}
