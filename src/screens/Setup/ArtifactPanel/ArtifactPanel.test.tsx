import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { ArtifactView } from "@/lib/ipc";

const getArtifactSource = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, commands: { getArtifactSource } };
});

const openExternal = vi.hoisted(() => vi.fn());
vi.mock("@/lib/open-external", () => ({ openExternal }));

import { ArtifactPanel } from "./index";

const ok = <T,>(data: T) => ({ status: "ok" as const, data });
const err = (error: string) => ({ status: "error" as const, error });

const MCP_JSON = '{\n  "command": "npx",\n  "env": {\n    "POSTHOG_KEY": "••••••"\n  }\n}';

const server = (over: Partial<ArtifactView> = {}): ArtifactView => ({
  id: 11,
  harness: "claude_code",
  layer: "global",
  kind: "mcp_server",
  name: "posthog",
  path: "/Users/a/.claude.json",
  plugin_name: null,
  description: null,
  bytes: 64,
  grade: null,
  score: null,
  file_id: null,
  usage: null,
  ...over,
});

async function open(artifact = server()) {
  const onClose = vi.fn();
  const view = render(<ArtifactPanel artifact={artifact} scope="Global" onClose={onClose} />);
  await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
  return { ...view, onClose };
}

beforeEach(() => {
  getArtifactSource.mockReset().mockResolvedValue(
    ok({ path: "/Users/a/.claude.json", content: MCP_JSON, bytes: 60, modified: "1", format: "json", editable: false }),
  );
  openExternal.mockReset();
});

afterEach(cleanup);

describe("ArtifactPanel", () => {
  it("names the artifact and says what kind it is", async () => {
    await open();
    expect(screen.getByRole("dialog")).toHaveAccessibleName("posthog — MCP server");
    expect(screen.getByRole("heading", { name: "posthog" })).toBeInTheDocument();
  });

  it("lists the inventory's facts about it", async () => {
    await open(server({ kind: "agent", name: "reviewer", description: "Reviews diffs" }));
    expect(screen.getByText("Reviews diffs")).toBeInTheDocument();
    expect(screen.getByText("Global")).toBeInTheDocument();
  });

  it("shows a config excerpt verbatim, secrets already masked by the backend", async () => {
    const { container } = await open();
    expect(getArtifactSource).toHaveBeenCalledWith(11);
    expect(container.querySelector("pre")).toHaveTextContent('"POSTHOG_KEY": "••••••"');
  });

  it("renders a markdown file as markdown", async () => {
    getArtifactSource.mockResolvedValue(
      ok({ path: "/a.md", content: "# Reviewer\n\nBody.", bytes: 16, modified: "1", format: "markdown", editable: false }),
    );
    await open(server({ kind: "agent", name: "reviewer" }));
    expect(screen.getByRole("heading", { name: "Reviewer" })).toBeInTheDocument();
  });

  it("says so while the source is loading", () => {
    getArtifactSource.mockReturnValue(new Promise(() => {}));
    render(<ArtifactPanel artifact={server()} scope="Global" onClose={() => {}} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows a failed read instead of an empty document", async () => {
    getArtifactSource.mockResolvedValue(err("That entry is no longer in .claude.json."));
    await open();
    expect(screen.getByRole("alert")).toHaveTextContent("no longer in .claude.json");
  });

  it("offers no editing", async () => {
    await open();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("opens the file on disk on request", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Open posthog on disk" }));
    expect(openExternal).toHaveBeenCalledWith("/Users/a/.claude.json");
  });

  it("closes on Escape", async () => {
    const { onClose } = await open();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("has no accessibility violations", async () => {
    const { container } = await open();
    expect(await axe(container)).toHaveNoViolations();
  });
});
