import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { ArtifactView } from "@/lib/ipc";

const getArtifactSource = vi.hoisted(() => vi.fn());
const openArtifact = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, isTauri: true, commands: { getArtifactSource, openArtifact } };
});

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
  await waitFor(() => expect(screen.queryByText(`Reading ${artifact.name}…`)).not.toBeInTheDocument());
  return { ...view, onClose };
}

beforeEach(() => {
  getArtifactSource.mockReset().mockResolvedValue(
    ok({ path: "/Users/a/.claude.json", content: MCP_JSON, bytes: 60, modified: "1", format: "json", editable: false }),
  );
  openArtifact.mockReset().mockResolvedValue(ok(null));
});

afterEach(cleanup);

describe("ArtifactPanel", () => {
  it("names the artifact and says what kind it is", async () => {
    await open();
    expect(screen.getByRole("dialog")).toHaveAccessibleName("posthog — MCP server");
    expect(screen.getByRole("heading", { name: "posthog" })).toBeInTheDocument();
  });

  it("opens as the wide reader", async () => {
    await open();
    expect(screen.getByRole("dialog")).toHaveClass("sheet--wide");
  });

  it("sums up the artifact in one line, with its description under it", async () => {
    await open(server({ kind: "agent", name: "reviewer", description: "Reviews diffs" }));
    expect(screen.getByText("Reviews diffs")).toBeInTheDocument();
    expect(screen.getByText("Global")).toBeInTheDocument();
  });

  it("keeps the full facts behind Details, so the file comes first", async () => {
    await open(server({ usage: { total: 3, sessions: 2, last_used: null, error_rate: null, avg_turn_tokens: 900, count_30d: 0, count_prev_30d: 0 } }));
    expect(screen.queryByText("Avg tokens per turn")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("Avg tokens per turn")).toBeInTheDocument();
  });

  it("shows a config excerpt verbatim as numbered source, secrets already masked", async () => {
    await open();
    expect(getArtifactSource).toHaveBeenCalledWith(11);
    const source = screen.getByRole("region", { name: "posthog source" });
    expect(source).toHaveTextContent('"POSTHOG_KEY": "••••••"');
    expect(source.querySelectorAll(".cv__num")).toHaveLength(6);
  });

  it("renders a markdown file as markdown, with its source a click away", async () => {
    getArtifactSource.mockResolvedValue(
      ok({ path: "/a.md", content: "# Reviewer\n\nBody.", bytes: 16, modified: "1", format: "markdown", editable: false }),
    );
    await open(server({ kind: "agent", name: "reviewer" }));
    expect(screen.getByRole("heading", { name: "Reviewer" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    expect(screen.getByRole("region", { name: "reviewer source" })).toHaveTextContent("# Reviewer");
  });

  it("says so while the source is loading", () => {
    getArtifactSource.mockReturnValue(new Promise(() => {}));
    render(<ArtifactPanel artifact={server()} scope="Global" onClose={() => {}} />);
    expect(screen.getByText("Reading posthog…")).toBeInTheDocument();
  });

  it("shows a failed read, word for word, and reads again on request", async () => {
    getArtifactSource.mockResolvedValueOnce(err("Command get_artifact_source not allowed by ACL"));
    await open();
    expect(screen.getByRole("alert")).toHaveTextContent("Command get_artifact_source not allowed by ACL");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "posthog source" })).toBeInTheDocument());
    expect(getArtifactSource).toHaveBeenCalledTimes(2);
  });

  it("offers no editing", async () => {
    await open();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("reveals and opens the file through the backend, by artifact id", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    fireEvent.click(screen.getByRole("button", { name: "Open in editor" }));
    await waitFor(() => expect(openArtifact).toHaveBeenCalledWith(11, "open"));
    expect(openArtifact).toHaveBeenCalledWith(11, "reveal");
  });

  it("pins a refused action to the sheet without hiding the file", async () => {
    openArtifact.mockResolvedValue(err("That file is no longer on disk."));
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Open in editor" }));
    expect(await screen.findByText("That file is no longer on disk.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "posthog source" })).toBeInTheDocument();
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
