import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { Setup } from "./Setup";
import { populated } from "./setup.fixtures";

// The sheets Setup opens until the ItemViewer replaces them (Task 3.9), with
// the real panels mounted — `Setup.test.tsx` stubs them to test the table.

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
const listeners = vi.hoisted(() => new Map<string, Set<() => void>>());
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: () => void) => {
    // A set per event: the inventory and the grade badge both listen for `scan-done`.
    const handlers = listeners.get(event) ?? new Set();
    handlers.add(handler);
    listeners.set(event, handlers);
    return Promise.resolve(() => handlers.delete(handler));
  }),
}));

const getSetup = vi.hoisted(() => vi.fn());
const listFiles = vi.hoisted(() => vi.fn());
const getOverview = vi.hoisted(() => vi.fn());
const listTemplates = vi.hoisted(() => vi.fn());
const getEntitlement = vi.hoisted(() => vi.fn());
const getArtifactSource = vi.hoisted(() => vi.fn());
const saveArtifactSource = vi.hoisted(() => vi.fn());

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
    },
  };
});

const emit = async (event: string) => {
  await act(async () => {
    listeners.get(event)?.forEach((handler) => handler());
  });
};

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

beforeEach(() => {
  vi.clearAllMocks();
  listeners.clear();
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
});

afterEach(cleanup);

describe("the skill panel (until Task 3.9)", () => {
  /** Narrow to Skills and click the `adapt` row. */
  const openAdapt = async () => {
    await renderOn(/^Skills/);
    fireEvent.click(rowFor("adapt"));
    return await screen.findByRole("dialog");
  };

  const editAndSave = (panel: HTMLElement) => {
    fireEvent.click(within(panel).getByRole("button", { name: "Edit" }));
    fireEvent.change(within(panel).getByRole("textbox", { name: /markdown/i }), { target: { value: "# Edited" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Save" }));
  };

  it("opens when a skill row is clicked, showing that skill's file", async () => {
    const panel = await openAdapt();

    expect(panel).toHaveAccessibleName(/adapt/);
    await waitFor(() => expect(getArtifactSource).toHaveBeenCalledWith(2));
    expect(await within(panel).findByRole("heading", { name: "From disk" })).toBeInTheDocument();
  });

  it("closes again", async () => {
    const panel = await openAdapt();
    fireEvent.click(within(panel).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("refreshes the inventory after a save, so the table stops showing the old size", async () => {
    const panel = await openAdapt();
    await within(panel).findByRole("heading", { name: "From disk" });
    const before = getSetup.mock.calls.length;

    editAndSave(panel);

    await waitFor(() => expect(saveArtifactSource).toHaveBeenCalledWith(2, "# Edited", "111"));
    await waitFor(() => expect(getSetup.mock.calls.length).toBeGreaterThan(before));
  });

  it("follows the refreshed row after a save, rather than the row it opened with", async () => {
    const panel = await openAdapt();
    await within(panel).findByRole("heading", { name: "From disk" });
    const renamed = { ...populated, global: populated.global.map((a) => (a.id === 2 ? { ...a, name: "adapts" } : a)) };
    getSetup.mockResolvedValue({ status: "ok", data: renamed });

    editAndSave(panel);

    await waitFor(() => expect(screen.getByRole("dialog")).toHaveAccessibleName(/adapts/));
  });

  it("closes itself if the skill is gone from the inventory after a rescan", async () => {
    await openAdapt();
    getSetup.mockResolvedValue({ status: "ok", data: { ...populated, global: populated.global.filter((a) => a.id !== 2) } });

    await emit("scan-done");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

describe("the detail sheet (until Task 3.9)", () => {
  beforeEach(() => {
    getArtifactSource.mockResolvedValue({
      status: "ok",
      data: { path: "/x", content: '{ "command": "npx" }', bytes: 20, modified: "1", format: "json", editable: false },
    });
  });

  it.each([
    [/^MCP servers/, "linear", 6, "linear — MCP server"],
    [/^Hooks/, "PreToolUse: fmt", 7, "PreToolUse: fmt — Hook"],
    [/^Agents/, "code-reviewer", 5, "code-reviewer — Agent"],
    [/^Plugins/, "superpowers", 8, "superpowers — Plugin"],
  ])("opens read-only for a row on the %s chip", async (kind, name, id, label) => {
    await renderOn(kind);
    fireEvent.click(rowFor(name));

    const sheet = await screen.findByRole("dialog");
    expect(sheet).toHaveAccessibleName(label);
    await waitFor(() => expect(getArtifactSource).toHaveBeenCalledWith(id));
    expect(within(sheet).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    await renderOn(/^MCP servers/);
    fireEvent.click(rowFor("linear"));

    fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
