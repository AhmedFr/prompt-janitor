import { describe, expect, it } from "vitest";
import { highlightLines, languageFor } from "./codeView.util";
import type { CodeToken } from "./CodeView.types";

const textOf = (line: CodeToken[]) => line.map((t) => t.text).join("");
const classesOf = (line: CodeToken[], text: string) => line.find((t) => t.text.includes(text))?.classes ?? [];

describe("languageFor", () => {
  it("reads the language off the file's extension", () => {
    expect(languageFor("/a/SKILL.md", "markdown")).toBe("markdown");
    expect(languageFor("/a/rule.mdc", "markdown")).toBe("markdown");
    expect(languageFor("/a/config.toml", "text")).toBe("toml");
    expect(languageFor("/a/compose.yml", "text")).toBe("yaml");
    expect(languageFor("/a/compose.yaml", "text")).toBe("yaml");
    expect(languageFor("/a/hook.sh", "text")).toBe("shell");
    expect(languageFor("/a/settings.json", "json")).toBe("json");
  });

  it("ignores the extension's case", () => {
    expect(languageFor("/a/README.MD", "markdown")).toBe("markdown");
  });

  it("falls back to the backend's format when the extension says nothing", () => {
    // A hook or MCP server is an excerpt cut out of `~/.claude.json`, but the
    // path is still the file's — and an extensionless file can be JSON too.
    expect(languageFor("/a/.claude", "json")).toBe("json");
    expect(languageFor(null, "markdown")).toBe("markdown");
  });

  it("is plain text when neither the path nor the format names a language", () => {
    expect(languageFor("/a/LICENSE", "text")).toBeNull();
    expect(languageFor(null, "text")).toBeNull();
  });
});

describe("highlightLines", () => {
  it("returns one entry per line, each reading back as the original line", () => {
    const source = '{\n  "command": "npx",\n  "args": ["-y"]\n}';
    const lines = highlightLines(source, "json");
    expect(lines.map(textOf)).toEqual(source.split("\n"));
  });

  it("tags tokens with highlight.js classes", () => {
    const [, second] = highlightLines('{\n  "command": "npx"\n}', "json");
    expect(classesOf(second, '"command"')).toContain("hljs-attr");
    expect(classesOf(second, '"npx"')).toContain("hljs-string");
  });

  it("carries a token's classes onto every line it spans", () => {
    // A fenced block is one highlight.js node spanning three lines; each line
    // has to repeat the class, or the middle of the block renders unstyled.
    const lines = highlightLines("```\nconst a = 1\n```", "markdown");
    expect(lines).toHaveLength(3);
    for (const line of lines) expect(line.every((t) => t.classes.includes("hljs-code"))).toBe(true);
  });

  it("highlights frontmatter as YAML, not as a heading underlined by its closing fence", () => {
    // highlight.js's markdown grammar reads `model: sonnet` followed by `---`
    // as a setext heading — the last header key renders bold, keys uncoloured.
    const lines = highlightLines("---\nname: adapt\nmodel: sonnet\n---\n# Adapt", "markdown");
    expect(lines.map(textOf)).toEqual(["---", "name: adapt", "model: sonnet", "---", "# Adapt"]);
    expect(classesOf(lines[1], "name")).toContain("hljs-attr");
    expect(classesOf(lines[2], "model")).toContain("hljs-attr");
    expect(lines[2].some((t) => t.classes.includes("hljs-section"))).toBe(false);
    expect(classesOf(lines[0], "---")).toContain("hljs-meta");
    expect(classesOf(lines[4], "# Adapt")).toContain("hljs-section");
  });

  it("draws an empty header and a header-only file without phantom lines", () => {
    expect(highlightLines("---\n---\n# A", "markdown").map(textOf)).toEqual(["---", "---", "# A"]);
    expect(highlightLines("---\na: b\n---", "markdown").map(textOf)).toEqual(["---", "a: b", "---"]);
    expect(highlightLines("---\na: b\n---\n", "markdown").map(textOf)).toEqual(["---", "a: b", "---"]);
  });

  it("leaves an unterminated fence to the markdown grammar", () => {
    const lines = highlightLines("---\nname: adapt", "markdown");
    expect(lines.map(textOf)).toEqual(["---", "name: adapt"]);
  });

  it("draws no phantom last line for a file that ends in a newline", () => {
    expect(highlightLines("a\nb\n", null).map(textOf)).toEqual(["a", "b"]);
  });

  it("keeps a genuinely blank last line", () => {
    expect(highlightLines("a\n\n", null).map(textOf)).toEqual(["a", ""]);
  });

  it("returns unclassed tokens for plain text", () => {
    const lines = highlightLines("hello\nworld", null);
    expect(lines).toEqual([[{ text: "hello", classes: [] }], [{ text: "world", classes: [] }]]);
  });

  it("gives an empty line no tokens rather than an empty one", () => {
    expect(highlightLines("a\n\nb", null)[1]).toEqual([]);
  });

  it("handles a 5,000-line file", () => {
    const source = Array.from({ length: 5000 }, (_, i) => `key_${i}: value ${i}`).join("\n");
    const lines = highlightLines(source, "yaml");
    expect(lines).toHaveLength(5000);
    expect(textOf(lines[4999])).toBe("key_4999: value 4999");
  });
});
