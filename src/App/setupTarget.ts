import { KIND_CHIP_ORDER, type KindFilter } from "@/lib/vocabulary";

export type StatusFilter = "never" | "errors" | "cost";
export type ViewerTab = "content" | "findings" | "usage";
export type ItemRef = { artifactId: number } | { fileId: string };

/** Everything a link into Setup can ask for (spec §10); every field optional. */
export interface SetupTarget {
  kind?: KindFilter;
  filter?: StatusFilter;
  lens?: string;
  open?: ItemRef;
  tab?: ViewerTab;
}

const FILTERS: readonly StatusFilter[] = ["never", "errors", "cost"];
const TABS: readonly ViewerTab[] = ["content", "findings", "usage"];
const isKind = (v: string | null): v is KindFilter => v !== null && (KIND_CHIP_ORDER as readonly string[]).includes(v);

/**
 * A Setup deep link as a query string (`kind=skill&filter=never&lens=…&open=a:12&tab=findings`),
 * so it survives the panel → main-window `navigate` event, which carries a
 * plain string. A bare kind (`"mcp_server"`) is still accepted — that is what
 * links sent before this format looked like.
 */
export function parseSetupTarget(raw: string | null | undefined): SetupTarget {
  if (!raw) return {};
  if (!raw.includes("=")) return isKind(raw) ? { kind: raw } : {};
  const q = new URLSearchParams(raw);
  const out: SetupTarget = {};
  const kind = q.get("kind");
  if (isKind(kind)) out.kind = kind;
  const filter = q.get("filter");
  if (filter && (FILTERS as readonly string[]).includes(filter)) out.filter = filter as StatusFilter;
  const lens = q.get("lens");
  if (lens) out.lens = lens;
  const open = q.get("open");
  if (open?.startsWith("a:") && /^-?\d+$/.test(open.slice(2))) out.open = { artifactId: Number(open.slice(2)) };
  else if (open?.startsWith("f:") && open.length > 2) out.open = { fileId: open.slice(2) };
  const tab = q.get("tab");
  if (tab && (TABS as readonly string[]).includes(tab)) out.tab = tab as ViewerTab;
  return out;
}

export function formatSetupTarget(t: SetupTarget): string | undefined {
  const q = new URLSearchParams();
  if (t.kind) q.set("kind", t.kind);
  if (t.filter) q.set("filter", t.filter);
  if (t.lens) q.set("lens", t.lens);
  if (t.open) q.set("open", "artifactId" in t.open ? `a:${t.open.artifactId}` : `f:${t.open.fileId}`);
  if (t.tab) q.set("tab", t.tab);
  const s = q.toString();
  return s.length > 0 ? s : undefined;
}
