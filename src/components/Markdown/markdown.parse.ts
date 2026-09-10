import type { Block, HeadingLevel, Span } from "./Markdown.types";

/**
 * Markdown for reading a skill file, parsed here rather than pulled in as a
 * dependency.
 *
 * Two passes, deliberately separate: {@link parseBlocks} decides what each
 * region of the document *is* (heading, list, fence) working line by line, and
 * {@link parseInline} decides what the text inside one block *says*. Blocks
 * never look inside a span and spans never look past their own string, which
 * is what keeps both small enough to hold in your head.
 *
 * Neither pass ever emits HTML — they emit data, and the renderer turns that
 * into React elements. A skill file cannot inject markup here because there is
 * no path from source text to markup at all.
 */

/** ` ```lang ` opens or closes a fenced block; the info string is optional. */
const FENCE = /^```(.*)$/;
/** `#` to `######` followed by a space. A seventh `#` fails to match and falls through to a paragraph. */
const HEADING = /^(#{1,6})\s+(.*)$/;
/** `-`, `*` or `+` followed by a space. */
const BULLET = /^[-*+]\s+(.*)$/;
/** `1.` / `1)` followed by a space. The number itself is not preserved — the renderer's `<ol>` counts. */
const ORDERED = /^\d+[.)]\s+(.*)$/;
/** `>` with or without the conventional trailing space. */
const QUOTE = /^>\s?(.*)$/;
/** Three or more `-`, `*` or `_`, alone on the line. */
const HR = /^\s*([-*_])\s*(?:\1\s*){2,}$/;

/**
 * Splits markdown into blocks.
 *
 * Fences are checked before everything else and consume lines verbatim until
 * they close, so a `#` or `-` inside a code sample stays a `#` or a `-`. An
 * unterminated fence closes at the end of the document rather than discarding
 * the rest of the file — a truncated skill should still show what it has.
 */
export function parseBlocks(source: string): Block[] {
  const lines = source.split("\n");
  const blocks: Block[] = [];
  // The paragraph/quote lines gathered so far, waiting for the blank line or
  // change of block type that ends them.
  let para: string[] = [];
  let quote: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (para.length > 0) {
      blocks.push({ kind: "paragraph", text: para.join(" ") });
      para = [];
    }
    if (quote.length > 0) {
      blocks.push({ kind: "quote", text: quote.join(" ") });
      quote = [];
    }
    if (list) {
      blocks.push({ kind: "list", ordered: list.ordered, items: list.items });
      list = null;
    }
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const fence = FENCE.exec(line);
    if (fence) {
      flush();
      const lang = fence[1].trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !FENCE.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      // `i` now sits on the closing fence, or past the end when there was
      // none; the loop's own increment steps over it either way.
      blocks.push({ kind: "code", lang: lang.length > 0 ? lang : null, text: body.join("\n") });
      continue;
    }

    if (line.trim().length === 0) {
      flush();
      continue;
    }

    if (HR.test(line)) {
      flush();
      blocks.push({ kind: "hr" });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      flush();
      blocks.push({
        kind: "heading",
        level: heading[1].length as HeadingLevel,
        text: heading[2].trim(),
      });
      continue;
    }

    const quoted = QUOTE.exec(line);
    if (quoted) {
      // A quote ends whatever else was open; only quote lines accumulate here.
      if (para.length > 0 || list) flush();
      quote.push(quoted[1].trim());
      continue;
    }

    const bullet = BULLET.exec(line);
    const ordered = bullet ? null : ORDERED.exec(line);
    if (bullet || ordered) {
      const isOrdered = ordered !== null;
      const text = (bullet ?? ordered)![1].trim();
      // A change of marker type starts a new list rather than mixing `<ul>`
      // items into an `<ol>`.
      if (para.length > 0 || quote.length > 0 || (list && list.ordered !== isOrdered)) flush();
      if (!list) list = { ordered: isOrdered, items: [] };
      list.items.push(text);
      continue;
    }

    // A plain line while a list is open is a continuation of the last item
    // (a wrapped bullet), not a new paragraph.
    if (list) {
      list.items[list.items.length - 1] += ` ${line.trim()}`;
      continue;
    }
    if (quote.length > 0) {
      quote[quote.length - 1] += ` ${line.trim()}`;
      continue;
    }
    para.push(line.trim());
  }

  flush();
  return blocks;
}

/** Inline markers, longest first so `**` is tried before `*`. */
const MARKERS: { open: string; close: string; kind: "strong" | "em" | "code" }[] = [
  { open: "**", close: "**", kind: "strong" },
  { open: "__", close: "__", kind: "strong" },
  { open: "`", close: "`", kind: "code" },
  { open: "*", close: "*", kind: "em" },
  { open: "_", close: "_", kind: "em" },
];

/**
 * `[label](href)`, with no nested brackets or parentheses in either half.
 *
 * Both halves are length-bounded, and that bound is load-bearing rather than
 * decorative. Unbounded, `[^\]]*` scans to the end of the block looking for a
 * `]` that is not there, backtracks the whole way, and does it again at every
 * `[` — quadratic. A 200k run of `[` took 19 s in a real measurement, which
 * at this module's 1 MiB read cap extrapolates to minutes of frozen webview
 * with no way out. Bounding the class caps the work per position instead:
 * the same input measures 271 ms.
 *
 * The limits are far past any real label or href, and a link that exceeds
 * them degrades to literal text rather than to a wrong parse.
 */
const LINK = /^\[([^\]]{0,512})\]\(([^)\s]{0,2048})\)/;

/** The only schemes a rendered link may carry. */
const SAFE_SCHEMES = ["http", "https", "mailto"];

/**
 * Whether an href is safe to put in an anchor.
 *
 * Refusing `javascript:` means refusing every spelling of it the *browser*
 * accepts, not every spelling that looks obvious in source. Two gaps make
 * that harder than it reads:
 *
 * - The URL parser strips leading C0 controls and spaces before it looks for
 *   a scheme, and it strips tabs and newlines from anywhere in the string.
 *   `String.prototype.trim` removes whitespace but leaves `\u0000`-`\u0008`
 *   and `\u000e`-`\u001f` in place — so a raw-string check reads
 *   `"\u0001javascript:…"` as having no scheme at all, calls it relative, and
 *   waves through an href the browser resolves to `javascript:`. Every
 *   control character is stripped here first, for exactly that reason.
 * - A protocol-relative `//host/path` has no scheme either, but it is not
 *   relative in the sense that matters: it navigates off to another origin.
 *
 * Anything that survives with no scheme is genuinely same-document — `#anchor`
 * or `./file.md` — and can only ever address the app's own page.
 *
 * This is defence in depth, not the only defence: the shipped CSP has no
 * `unsafe-inline`, so a `javascript:` URL would not run in a release build.
 * The dev CSP does allow it, and a control that only works because a second
 * control is present is not doing its job.
 */
export function safeHref(href: string): boolean {
  // eslint-disable-next-line no-control-regex -- stripping controls is the point
  const clean = href.replace(/[\u0000-\u0020\u007f]/g, "");
  if (clean.startsWith("//")) return false;
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(clean);
  if (!scheme) return true;
  return SAFE_SCHEMES.includes(scheme[1].toLowerCase());
}

/**
 * Splits one block's text into styled runs.
 *
 * Scans left to right, taking the first marker that both opens at the cursor
 * and closes later in the string. A marker that never closes is not markup —
 * it is a literal asterisk in someone's prose — so it is emitted as text and
 * the scan moves on. Inline code is opaque: `` `a *b* c` `` keeps its
 * asterisks, because a code span that reformatted its own contents would
 * misquote the command it is showing.
 */
export function parseInline(text: string): Span[] {
  const spans: Span[] = [];
  let plain = "";
  let i = 0;

  const flushPlain = () => {
    if (plain.length > 0) {
      spans.push({ kind: "text", text: plain });
      plain = "";
    }
  };

  while (i < text.length) {
    const rest = text.slice(i);

    if (rest.startsWith("[")) {
      const link = LINK.exec(rest);
      if (link && safeHref(link[2])) {
        flushPlain();
        spans.push({ kind: "link", text: link[1], href: link[2] });
        i += link[0].length;
        continue;
      }
      // An unparseable link, or one with a scheme we refuse, stays literal —
      // including its brackets, so nothing silently disappears from the file.
      if (link) {
        plain += link[0];
        i += link[0].length;
        continue;
      }
    }

    const marker = MARKERS.find((m) => rest.startsWith(m.open));
    if (marker) {
      const closeAt = rest.indexOf(marker.close, marker.open.length);
      // Refuse an empty body too (`****`): it is punctuation, not emphasis.
      if (closeAt > marker.open.length) {
        flushPlain();
        spans.push({ kind: marker.kind, text: rest.slice(marker.open.length, closeAt) });
        i += closeAt + marker.close.length;
        continue;
      }
    }

    plain += text[i];
    i += 1;
  }

  flushPlain();
  return spans;
}
