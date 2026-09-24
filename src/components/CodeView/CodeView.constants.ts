import type { CodeLanguage } from "./CodeView.types";

/**
 * File extension → grammar. TOML is coloured with highlight.js's `ini`
 * grammar, which is the one it ships for TOML: same sections, same `key =
 * value` lines, and one grammar fewer in the bundle.
 */
export const LANGUAGE_BY_EXTENSION: Record<string, CodeLanguage> = {
  md: "markdown",
  markdown: "markdown",
  mdc: "markdown",
  json: "json",
  jsonc: "json",
  toml: "toml",
  yaml: "yaml",
  yml: "yaml",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
};

/** The highlight.js grammar registered under each language. */
export const GRAMMAR_NAME: Record<CodeLanguage, string> = {
  markdown: "markdown",
  json: "json",
  toml: "ini",
  yaml: "yaml",
  shell: "bash",
};
