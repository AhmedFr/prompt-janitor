import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, within } from "@testing-library/react";
import type { FileRow } from "@/lib/ipc";
import { Setup } from "./Setup";
import { populated } from "./setup.fixtures";

// Setup with the real ItemViewer mounted over mocked IPC — `Setup.test.tsx`
// stubs the viewer's reads to test the table's wiring.

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(() => Promise.resolve(() => {})) }));

const getSetup = vi.hoisted(() => vi.fn());
const listFiles = vi.hoisted(() => vi.fn());
const getOverview = vi.hoisted(() => vi.fn());
const listTemplates = vi.hoisted(() => vi.fn());
const getEntitlement = vi.hoisted(() => vi.fn());
const getArtifactSource = vi.hoisted(() => vi.fn());
const saveArtifactSource = vi.hoisted(() => vi.fn());
const getFileDetail = vi.hoisted(() => vi.fn());
const getAiConfig = vi.hoisted(() => vi.fn());
const hasBackup = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return {
    ...actual,
    isTauri: true,
    commands: {
      getSetup,
      listFiles,
      getOverview,
      listTemplates,
      getEntitlement,
      getArtifactSource,
      saveArtifactSource,
      getFileDetail,
      getAiConfig,
      hasBackup,
    },
  };
});

const bodyRows = () => [...document.querySelectorAll<HTMLElement>("tbody tr.dt__row")];
const rowFor = (name: string) =>
  bodyRows().find((row) => (row.querySelector("td")?.textContent ?? "").startsWith(name)) as HTMLElement;
const pickKind = (label: RegExp) => fireEvent.click(screen.getByRole("radio", { name: label }));

/** Setup on its live data, narrowed to one kind. */
const renderOn = async (kind: RegExp) => {
  render(<Setup navigate={vi.fn()} />);
  await screen.findByRole("radiogroup", { name: "Kinds" });
  pickKind(kind);
};

/** A graded file the inventory never saw: its row's id is synthetic (negative). */
const orphan: FileRow = {
  id: "/x/AGENTS.md",
  name: "AGENTS.md",
  path: "/x/AGENTS.md",
  project: "x",
  project_id: "/x",
  kind: "AGENTS.md",
  grade: "D",
  score: 55,
  issue_count: 1,
  modified: null,
  worst_severity: "hi",
};

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  getSetup.mockResolvedValue({ status: "ok", data: populated });
  listFiles.mockResolvedValue({ status: "ok", data: [] });
  getOverview.mockResolvedValue({ status: "ok", data: { has_data: false, overall_grade: "F" } });
  listTemplates.mockResolvedValue([]);
  getEntitlement.mockResolvedValue({ status: "ok", data: { paid: false } });
  getArtifactSource.mockResolvedValue({
    status: "ok",
    data: { path: "/s/SKILL.md", content: "# From disk\n", bytes: 12, modified: "111", format: "markdown", editable: true },
  });
  saveArtifactSource.mockResolvedValue({ status: "ok", data: { bytes: 20 } });
  getAiConfig.mockResolvedValue({ status: "ok", data: { provider: "none", has_key: false } });
  hasBackup.mockResolvedValue({ status: "ok", data: false });
});

afterEach(cleanup);

describe("Setup — saving from the viewer", () => {
  /** Narrow to Skills and open the `adapt` row, waiting for its file. */
  const openAdapt = async () => {
    await renderOn(/^Skills/);
    fireEvent.click(rowFor("adapt"));
    const viewer = await screen.findByRole("dialog");
    await within(viewer).findByRole("heading", { name: "From disk" });
    return viewer;
  };

  const editAndSave = (viewer: HTMLElement) => {
    fireEvent.click(within(viewer).getByRole("button", { name: "Edit" }));
    fireEvent.change(within(viewer).getByRole("textbox", { name: "Item source" }), { target: { value: "# Edited" } });
    fireEvent.click(within(viewer).getByRole("button", { name: "Save" }));
  };

  it("refreshes the inventory after a save, so the table stops showing the old size", async () => {
    const viewer = await openAdapt();
    const before = getSetup.mock.calls.length;

    editAndSave(viewer);

    await waitFor(() => expect(saveArtifactSource).toHaveBeenCalledWith(2, "# Edited", "111"));
    await waitFor(() => expect(getSetup.mock.calls.length).toBeGreaterThan(before));
  });

  it("follows the refreshed row after a save, rather than the row it opened with", async () => {
    const viewer = await openAdapt();
    const renamed = { ...populated, global: populated.global.map((a) => (a.id === 2 ? { ...a, name: "adapts" } : a)) };
    getSetup.mockResolvedValue({ status: "ok", data: renamed });

    editAndSave(viewer);

    await waitFor(() => expect(screen.getByRole("dialog")).toHaveAccessibleName(/^adapts/));
  });
});

describe("Setup — a graded-only row", () => {
  it("opens in the viewer with its file and its findings", async () => {
    listFiles.mockResolvedValue({ status: "ok", data: [orphan] });
    getFileDetail.mockResolvedValue({
      status: "ok",
      data: {
        id: orphan.id, name: orphan.name, project: "x", path: orphan.path, grade: "D", score: 55,
        content: "# Agents guide\n\nRun npm.", delta: null, dimensions: [],
        issues: [{ line: 3, severity: "hi", source: "anthropic", title: "Wrong package manager", why: "Repo uses pnpm", fix_from: null, fix_to: null }],
      },
    });
    await renderOn(/^Instructions/);

    fireEvent.click(rowFor("AGENTS.md"));

    const viewer = await screen.findByRole("dialog");
    expect(viewer).toHaveAccessibleName(/^AGENTS\.md/);
    expect(await within(viewer).findByRole("heading", { name: "Agents guide" })).toBeInTheDocument();
    expect(getFileDetail).toHaveBeenCalledWith(orphan.id);
    // No artifact id to read by: the synthetic id never reaches the inventory read.
    expect(getArtifactSource).not.toHaveBeenCalled();

    fireEvent.click(within(viewer).getByRole("tab", { name: /Findings/ }));
    expect(await within(viewer).findByText("Wrong package manager")).toBeInTheDocument();
  });
});

describe("Setup — which items open editable", () => {
  it.each([
    [/^MCP servers/, "linear", 6, "linear — MCP server", false],
    [/^Hooks/, "PreToolUse: fmt", 7, "PreToolUse: fmt — Hook", false],
    [/^Plugins/, "superpowers", 8, "superpowers — Plugin", false],
    [/^Agents/, "code-reviewer", 5, "code-reviewer — Agent", true],
  ])("a row on the %s chip (%s) opens editable only where the backend allows it", async (kind, name, id, label, editable) => {
    getArtifactSource.mockResolvedValue({
      status: "ok",
      data: { path: "/x", content: "# Source\n", bytes: 9, modified: "1", format: "markdown", editable },
    });
    await renderOn(kind);
    fireEvent.click(rowFor(name));

    const viewer = await screen.findByRole("dialog");
    expect(viewer).toHaveAccessibleName(label);
    await waitFor(() => expect(getArtifactSource).toHaveBeenCalledWith(id));
    await within(viewer).findByRole("heading", { name: "Source" });
    if (editable) expect(within(viewer).getByRole("button", { name: "Edit" })).toBeInTheDocument();
    else expect(within(viewer).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });
});
