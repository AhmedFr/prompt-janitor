import { describe, it, expect } from "vitest";
import { parseBlocks, parseInline } from "./markdown.parse";

describe("parseBlocks", () => {
  it("reads an ATX heading and its level", () => {
    expect(parseBlocks("## Usage")).toEqual([{ kind: "heading", level: 2, text: "Usage" }]);
  });

  it("caps heading level at 6, so `####### x` is a paragraph", () => {
    expect(parseBlocks("####### x")).toEqual([{ kind: "paragraph", text: "####### x" }]);
  });

  it("joins wrapped lines into one paragraph", () => {
    expect(parseBlocks("one\ntwo")).toEqual([{ kind: "paragraph", text: "one two" }]);
  });

  it("splits paragraphs on a blank line", () => {
    expect(parseBlocks("one\n\ntwo")).toEqual([
      { kind: "paragraph", text: "one" },
      { kind: "paragraph", text: "two" },
    ]);
  });

  it("collects consecutive bullets into one list", () => {
    expect(parseBlocks("- a\n- b")).toEqual([
      { kind: "list", ordered: false, items: ["a", "b"] },
    ]);
  });

  it("treats `*` and `+` as bullets too", () => {
    expect(parseBlocks("* a\n+ b")).toEqual([
      { kind: "list", ordered: false, items: ["a", "b"] },
    ]);
  });

  it("reads a numbered list as ordered", () => {
    expect(parseBlocks("1. first\n2. second")).toEqual([
      { kind: "list", ordered: true, items: ["first", "second"] },
    ]);
  });

  it("keeps a fenced code block verbatim, including its blank lines", () => {
    expect(parseBlocks("```sh\na\n\nb\n```")).toEqual([
      { kind: "code", lang: "sh", text: "a\n\nb" },
    ]);
  });

  it("does not treat a heading inside a fence as a heading", () => {
    expect(parseBlocks("```\n# not a heading\n```")).toEqual([
      { kind: "code", lang: null, text: "# not a heading" },
    ]);
  });

  it("closes an unterminated fence at the end of the document", () => {
    expect(parseBlocks("```\nstranded")).toEqual([{ kind: "code", lang: null, text: "stranded" }]);
  });

  it("collects consecutive quote lines into one blockquote", () => {
    expect(parseBlocks("> a\n> b")).toEqual([{ kind: "quote", text: "a b" }]);
  });

  it("reads a thematic break", () => {
    expect(parseBlocks("---")).toEqual([{ kind: "hr" }]);
  });

  it("returns nothing for an empty document", () => {
    expect(parseBlocks("")).toEqual([]);
  });

  it("ignores trailing whitespace-only lines", () => {
    expect(parseBlocks("text\n   \n")).toEqual([{ kind: "paragraph", text: "text" }]);
  });
});

describe("parseInline", () => {
  it("returns one text span when there is no markup", () => {
    expect(parseInline("plain")).toEqual([{ kind: "text", text: "plain" }]);
  });

  it("reads bold", () => {
    expect(parseInline("a **b** c")).toEqual([
      { kind: "text", text: "a " },
      { kind: "strong", text: "b" },
      { kind: "text", text: " c" },
    ]);
  });

  it("reads italic", () => {
    expect(parseInline("*b*")).toEqual([{ kind: "em", text: "b" }]);
  });

  it("reads inline code", () => {
    expect(parseInline("run `pnpm check`")).toEqual([
      { kind: "text", text: "run " },
      { kind: "code", text: "pnpm check" },
    ]);
  });

  it("does not read emphasis inside inline code", () => {
    expect(parseInline("`a *b* c`")).toEqual([{ kind: "code", text: "a *b* c" }]);
  });

  it("reads a link's label and href", () => {
    expect(parseInline("[docs](https://x.dev)")).toEqual([
      { kind: "link", text: "docs", href: "https://x.dev" },
    ]);
  });

  it("renders a javascript: link as plain text rather than a link", () => {
    expect(parseInline("[x](javascript:alert(1))")).toEqual([
      { kind: "text", text: "[x](javascript:alert(1))" },
    ]);
  });

  it("leaves an unterminated marker as literal text", () => {
    expect(parseInline("a **b")).toEqual([{ kind: "text", text: "a **b" }]);
  });
});
