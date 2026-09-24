import type { SourceFormat } from "@/lib/ipc";
import type { ViewMode } from "./FileViewer.types";

/** The views a format has. Only markdown renders into something else. */
export function modesFor(format: SourceFormat): ViewMode[] {
  return format === "markdown" ? ["rendered", "source"] : ["source"];
}

/** What a file opens as: rendered when there is such a thing, else its source. */
export function defaultMode(format: SourceFormat): ViewMode {
  return modesFor(format)[0];
}

/** A byte count the way Finder writes one. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 10) return `${kb.toFixed(1)} KB`;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

const encoder = new TextEncoder();

/**
 * "142 lines · 4.1 KB". Lines are counted as the source view numbers them — a
 * trailing newline ends the last line rather than opening one more — and
 * bytes are UTF-8, the unit of the table's Size column.
 */
export function fileStats(content: string): string {
  const breaks = content.split("\n").length - 1;
  const lines = content.length === 0 ? 0 : content.endsWith("\n") ? breaks : breaks + 1;
  const count = lines.toLocaleString("en-US");
  return `${count} ${lines === 1 ? "line" : "lines"} · ${formatBytes(encoder.encode(content).length)}`;
}
