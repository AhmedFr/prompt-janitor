import { describe, it, expect } from "vitest";
import { parseBlocks, parseInline, safeHref } from "./markdown.parse";

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

  /**
   * A link label longer than the cap is not markup. The cap exists so a run of
   * unmatched `[` cannot make the scan quadratic (see `LINK`); a real label
   * never comes close to it.
   */
  it("does not treat an overlong label as a link", () => {
    const long = `[${"a".repeat(600)}](https://x.dev)`;
    expect(parseInline(long)).toEqual([{ kind: "text", text: long }]);
  });

  it("parses a long run of unmatched brackets without hanging", () => {
    const start = performance.now();
    parseInline("[".repeat(200_000));
    expect(performance.now() - start).toBeLessThan(2_000);
  });

  it("leaves an unterminated marker as literal text", () => {
    expect(parseInline("a **b")).toEqual([{ kind: "text", text: "a **b" }]);
  });
});

/**
 * The scheme allowlist is the only thing standing between a skill file and an
 * anchor the app will happily hand to the platform. The bypasses below are the
 * ones that actually work: the browser's URL parser strips leading C0 controls
 * before it reads the scheme, so a check that reads the raw string sees no
 * scheme at all and waves the href through as "relative".
 */
describe("safeHref", () => {
  it("allows the schemes a document legitimately links to", () => {
    for (const href of ["https://x.dev", "http://x.dev", "mailto:a@x.dev", "HTTPS://x.dev"]) {
      expect(safeHref(href)).toBe(true);
    }
  });

  it("allows a relative or same-document href", () => {
    for (const href of ["#section", "./other.md", "docs/x.md"]) {
      expect(safeHref(href)).toBe(true);
    }
  });

  it("refuses javascript:, whatever case it is written in", () => {
    for (const href of ["javascript:alert(1)", "JaVaScRiPt:alert(1)", "JAVASCRIPT:alert(1)"]) {
      expect(safeHref(href)).toBe(false);
    }
  });

  it("refuses a scheme hidden behind leading whitespace or a C0 control", () => {
    // `String.trim` drops the whitespace but not the controls, and the URL
    // parser drops both — so a raw-string check disagrees with the browser
    // about where the scheme starts. These are the characters that exploits.
    for (const prefix of [" ", "\t", "\n", "\u0000", "\u0001", "\u001f", "\u000b"]) {
      expect(safeHref(`${prefix}javascript:alert(1)`)).toBe(false);
    }
  });

  it("refuses a control character buried inside the scheme", () => {
    expect(safeHref("java\u0000script:alert(1)")).toBe(false);
  });

  it("refuses the other schemes that execute or embed", () => {
    for (const href of ["data:text/html,<b>x</b>", "vbscript:x", "file:///etc/passwd", "blob:x"]) {
      expect(safeHref(href)).toBe(false);
    }
  });

  it("refuses a protocol-relative href, which is an external navigation", () => {
    expect(safeHref("//evil.example/x")).toBe(false);
  });
});
