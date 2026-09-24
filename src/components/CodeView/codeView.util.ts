import bash from "highlight.js/lib/languages/bash";
import ini from "highlight.js/lib/languages/ini";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import yaml from "highlight.js/lib/languages/yaml";
import { createLowlight } from "lowlight";
import type { SourceFormat } from "@/lib/ipc";
import { GRAMMAR_NAME, LANGUAGE_BY_EXTENSION } from "./CodeView.constants";
import type { CodeLanguage, CodeToken } from "./CodeView.types";

/**
 * Only the five grammars the harness's files are written in. `lowlight`'s
 * default export registers ~37 and `highlight.js`'s full build ~190; importing
 * each grammar by path is what keeps the rest out of the bundle.
 */
const lowlight = createLowlight({ bash, ini, json, markdown, yaml });

/** The subset of hast `lowlight` produces: spans with classes, and text. */
type HastNode =
  | { type: "text"; value: string }
  | { type: "element"; properties?: { className?: unknown }; children: HastNode[] }
  | { type: string; children?: HastNode[] };

/**
 * What to colour a file as: its extension first, since that is what the
 * harness itself goes by; the backend's format when the extension is silent
 * (an excerpt of `~/.claude.json`, a dotfile).
 */
export function languageFor(path: string | null, format: SourceFormat): CodeLanguage | null {
  const ext = path?.split("/").pop()?.split(".").slice(1).pop()?.toLowerCase();
  const byExtension = ext ? LANGUAGE_BY_EXTENSION[ext] : undefined;
  if (byExtension) return byExtension;
  if (format === "json") return "json";
  if (format === "markdown") return "markdown";
  return null;
}

/**
 * The file as lines of classed tokens, ready to draw one row per line.
 *
 * highlight.js returns one tree for the whole file, and a node in it can span
 * lines (a fenced block, a multi-line string). Flattening while carrying the
 * stack of classes down is what lets every line render on its own and still
 * be coloured as part of the node it sits in — and it is what makes the rows
 * cheap enough to draw a 5,000-line file without a virtualised list.
 *
 * A file ending in a newline has no line after it — the newline terminates the
 * last line, it does not open a new one — so a single trailing empty line is
 * dropped, the way every editor numbers it.
 */
export function highlightLines(content: string, language: CodeLanguage | null): CodeToken[][] {
  const header = language === "markdown" ? frontmatterEnd(content) : -1;
  let lines: CodeToken[][];
  if (header === -1) {
    lines = tokenize(content, language);
  } else {
    const all = content.split("\n");
    const yamlLines = all.slice(1, header);
    const bodyLines = all.slice(header + 1);
    lines = [
      ...fence(),
      ...(yamlLines.length > 0 ? tokenize(yamlLines.join("\n"), "yaml") : []),
      ...fence(),
      ...(bodyLines.length > 0 ? tokenize(bodyLines.join("\n"), "markdown") : []),
    ];
  }

  if (content.endsWith("\n") && lines.length > 1 && lines[lines.length - 1].length === 0) lines.pop();
  return lines;
}

/** A `---` fence line, drawn as punctuation. */
function fence(): CodeToken[][] {
  return [[{ text: "---", classes: ["hljs-meta"] }]];
}

/**
 * The line index of a markdown file's closing frontmatter fence, or -1.
 *
 * The header is coloured as the YAML it is rather than left to the markdown
 * grammar, which reads its last key followed by the closing `---` as a
 * setext heading. An unterminated fence is not a header — the same rule
 * `splitFrontmatter` applies — and stays markdown.
 */
function frontmatterEnd(content: string): number {
  const lines = content.split("\n");
  if (lines[0]?.trim() !== "---") return -1;
  return lines.findIndex((line, i) => i > 0 && line.trim() === "---");
}

/** One grammar over `content`, as lines of classed tokens. */
function tokenize(content: string, language: CodeLanguage | null): CodeToken[][] {
  const lines: CodeToken[][] = [[]];

  const push = (text: string, classes: string[]) => {
    const parts = text.split("\n");
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part.length > 0) lines[lines.length - 1].push({ text: part, classes });
    });
  };

  if (language === null) {
    push(content, []);
  } else {
    const walk = (node: HastNode, classes: string[]) => {
      if (node.type === "text" && "value" in node) {
        push(node.value, classes);
        return;
      }
      const own = node.type === "element" && "properties" in node ? classNames(node.properties?.className) : [];
      const next = own.length > 0 ? [...classes, ...own] : classes;
      for (const child of ("children" in node ? node.children : undefined) ?? []) walk(child, next);
    };
    walk(lowlight.highlight(GRAMMAR_NAME[language], content) as HastNode, []);
  }

  return lines;
}

function classNames(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return typeof value === "string" ? value.split(" ") : [];
}
