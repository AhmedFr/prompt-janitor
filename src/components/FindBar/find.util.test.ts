import { afterEach, describe, expect, it } from "vitest";
import { findRanges, matchOffsets } from "./find.util";

describe("matchOffsets", () => {
  it("finds every occurrence, ignoring case", () => {
    expect(matchOffsets("Env env ENV", "env")).toEqual([
      [0, 3],
      [4, 7],
      [8, 11],
    ]);
  });

  it("never overlaps matches", () => {
    expect(matchOffsets("aaaa", "aa")).toEqual([
      [0, 2],
      [2, 4],
    ]);
  });

  it("matches nothing for an empty or blank query", () => {
    expect(matchOffsets("anything", "")).toEqual([]);
    expect(matchOffsets("any thing", " ")).toEqual([]);
  });

  it("treats the query literally, not as a pattern", () => {
    expect(matchOffsets("a.b axb", "a.b")).toEqual([[0, 3]]);
  });
});

/** A range's text, whether it is a live `Range` or a `StaticRange`. */
function text(range: AbstractRange): string {
  const live = document.createRange();
  live.setStart(range.startContainer, range.startOffset);
  live.setEnd(range.endContainer, range.endOffset);
  return live.toString();
}

describe("findRanges", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("returns static ranges, which the DOM does not have to keep updated", () => {
    // A live Range is adjusted on every DOM mutation; ten thousand of them made
    // every re-render of a 5,000-line file take seconds.
    const root = mount("<p>a a a</p>");
    for (const range of findRanges(root, "a")) expect(range).toBeInstanceOf(StaticRange);
  });

  const mount = (html: string) => {
    const root = document.createElement("div");
    root.innerHTML = html;
    document.body.append(root);
    return root;
  };

  it("finds a match split across highlight spans", () => {
    // highlight.js splits `"command": "npx"` into several spans; a search for
    // `command": "n` crosses three of them and is still one match.
    const root = mount('<div data-find-block><span class="a">"command"</span>: <span class="s">"npx"</span></div>');
    const ranges = findRanges(root, 'command": "n');
    expect(ranges).toHaveLength(1);
    expect(text(ranges[0])).toBe('command": "n');
  });

  it("never matches across two blocks", () => {
    const root = mount("<div data-find-block>foo</div><div data-find-block>bar</div>");
    expect(findRanges(root, "foobar")).toEqual([]);
    expect(findRanges(root, "bar")).toHaveLength(1);
  });

  it("treats paragraphs and list items of rendered markdown as blocks too", () => {
    const root = mount("<p>end</p><ul><li>start</li></ul>");
    expect(findRanges(root, "endstart")).toEqual([]);
  });

  it("skips anything marked data-find-skip, such as line numbers", () => {
    const root = mount('<div data-find-block><span data-find-skip>12</span><span>x = 12</span></div>');
    const ranges = findRanges(root, "12");
    expect(ranges).toHaveLength(1);
    expect(ranges[0].startContainer.parentElement?.hasAttribute("data-find-skip")).toBe(false);
  });

  it("returns matches in document order", () => {
    const root = mount("<div data-find-block>b a</div><div data-find-block>a b</div>");
    expect(findRanges(root, "a").map((r) => r.startOffset)).toEqual([2, 0]);
  });

  it("returns nothing for a blank query", () => {
    const root = mount("<p>text</p>");
    expect(findRanges(root, "")).toEqual([]);
  });
});
