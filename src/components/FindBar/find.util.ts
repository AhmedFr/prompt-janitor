import { BLOCK_SELECTOR, SKIP_SELECTOR } from "./FindBar.constants";

/**
 * Where `query` occurs in `text`, case-insensitively, as `[start, end)` pairs.
 * Literal, not a pattern: someone searching a config for `a.b` means the dot.
 */
export function matchOffsets(text: string, query: string): [number, number][] {
  const needle = query.toLowerCase();
  if (needle.trim().length === 0) return [];
  const haystack = text.toLowerCase();
  const found: [number, number][] = [];
  for (let at = haystack.indexOf(needle); at !== -1; at = haystack.indexOf(needle, at + needle.length)) {
    found.push([at, at + needle.length]);
  }
  return found;
}

/** One text node inside a block, and where its text starts in the block's joined text. */
interface Piece {
  node: Text;
  start: number;
}

/**
 * Every match of `query` under `root`, as DOM ranges in document order.
 *
 * Text is matched per block (a code row, a paragraph, a list item) with the
 * block's text nodes joined, so a match survives highlight.js splitting a
 * line into a dozen spans, yet never runs from the end of one line into the
 * start of the next. Anything under `data-find-skip` — the line numbers — is
 * invisible to the search.
 *
 * Ranges rather than wrapping `<mark>`s: they are painted through the CSS
 * Custom Highlight API, so finding never mutates the DOM React owns. And
 * *static* ranges: the DOM keeps every live `Range` up to date on every
 * mutation, so ten thousand of them (one letter in a 5,000-line file) turned
 * each re-render of the file into seconds of work.
 */
export function findRanges(root: Element, query: string): AbstractRange[] {
  if (query.trim().length === 0) return [];

  const blocks = new Map<Element, Piece[]>();
  const order: Element[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest(SKIP_SELECTOR) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });

  for (let node = walker.nextNode() as Text | null; node; node = walker.nextNode() as Text | null) {
    const block = node.parentElement?.closest(BLOCK_SELECTOR) ?? root;
    let pieces = blocks.get(block);
    if (!pieces) {
      pieces = [];
      blocks.set(block, pieces);
      order.push(block);
    }
    const last = pieces[pieces.length - 1];
    pieces.push({ node, start: last ? last.start + last.node.data.length : 0 });
  }

  const ranges: AbstractRange[] = [];
  for (const block of order) {
    const pieces = blocks.get(block) ?? [];
    const text = pieces.map((p) => p.node.data).join("");
    for (const [start, end] of matchOffsets(text, query)) {
      const from = locate(pieces, start, false);
      const to = locate(pieces, end, true);
      ranges.push(staticRange(from.node, from.offset, to.node, to.offset));
    }
  }
  return ranges;
}

/** A `StaticRange` where the webview has one, else a live `Range`. */
function staticRange(startContainer: Text, startOffset: number, endContainer: Text, endOffset: number): AbstractRange {
  if (typeof StaticRange === "function") return new StaticRange({ startContainer, startOffset, endContainer, endOffset });
  const range = document.createRange();
  range.setStart(startContainer, startOffset);
  range.setEnd(endContainer, endOffset);
  return range;
}

/**
 * The text node and offset for a position in a block's joined text. An `end`
 * position on a piece boundary belongs to the piece before it, so a range
 * never ends at offset 0 of the next span.
 */
function locate(pieces: Piece[], at: number, end: boolean): { node: Text; offset: number } {
  for (const piece of pieces) {
    const length = piece.node.data.length;
    const inside = end ? at > piece.start && at <= piece.start + length : at >= piece.start && at < piece.start + length;
    if (inside) return { node: piece.node, offset: at - piece.start };
  }
  const last = pieces[pieces.length - 1];
  return { node: last.node, offset: last.node.data.length };
}
