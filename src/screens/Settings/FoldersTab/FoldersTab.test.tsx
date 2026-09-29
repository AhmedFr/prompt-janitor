import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import { FoldersTab } from "./FoldersTab";
import type { HarnessInfo } from "@/lib/ipc";

const open = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));

// One handler registry per test so a case can emit `scan-done` like the core does.
const listeners = vi.hoisted(() => new Map<string, () => void>());
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: () => void) => {
    listeners.set(event, handler);
    return Promise.resolve(() => listeners.delete(event));
  }),
}));

const listHarnesses = vi.hoisted(() => vi.fn());
const getExtraScanFolders = vi.hoisted(() => vi.fn());
const setExtraScanFolders = vi.hoisted(() => vi.fn());
const scanNow = vi.hoisted(() => vi.fn());
const previewFolderRemoval = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return {
    ...actual,
    isTauri: true,
    commands: { listHarnesses, getExtraScanFolders, setExtraScanFolders, scanNow, previewFolderRemoval },
  };
});

const harnesses: HarnessInfo[] = [
  {
    id: "claude_code",
    display_name: "Claude Code",
    detected: true,
    last_scan_at: "2026-08-20T09:00:00.000Z",
    project_count: 32,
    session_count: 177,
  },
  {
    id: "cursor",
    display_name: "Cursor",
    detected: false,
    last_scan_at: null,
    project_count: 0,
    session_count: 0,
  },
];

beforeEach(() => {
  listeners.clear();
  listHarnesses.mockResolvedValue({ status: "ok", data: harnesses });
  getExtraScanFolders.mockResolvedValue({ status: "ok", data: ["/code/scratch"] });
  setExtraScanFolders.mockResolvedValue({ status: "ok", data: null });
  scanNow.mockResolvedValue({ status: "ok", data: { files: 0, ms: 1 } });
  previewFolderRemoval.mockResolvedValue({ status: "ok", data: [] });
  open.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("FoldersTab rows", () => {
  it("lists each registered harness as detected or not detected", async () => {
    render(<FoldersTab />);
    expect(await screen.findByText("Claude Code — detected · 32 projects · 177 sessions")).toBeInTheDocument();
    expect(screen.getByText("Cursor — not detected")).toBeInTheDocument();
  });

  it("shows a relative last-scanned time only for the detected harness", async () => {
    const recent: HarnessInfo[] = [
      { ...harnesses[0], last_scan_at: new Date(Date.now() - 5 * 60_000).toISOString() },
      harnesses[1],
    ];
    listHarnesses.mockResolvedValue({ status: "ok", data: recent });

    render(<FoldersTab />);

    expect(await screen.findByText(/^last scanned \d+m ago$/)).toBeInTheDocument();
    expect(screen.queryByText("Cursor — not detected")?.parentElement?.textContent).not.toMatch(
      /last scanned/,
    );
  });
});

describe("FoldersTab extra folders", () => {
  it("lists extra folders with a Remove button that drops the path", async () => {
    render(<FoldersTab />);
    expect(await screen.findByText("/code/scratch")).toBeInTheDocument();

    getExtraScanFolders.mockResolvedValue({ status: "ok", data: [] });
    fireEvent.click(screen.getByRole("button", { name: "Remove /code/scratch" }));

    await waitFor(() => expect(setExtraScanFolders).toHaveBeenCalledWith([]));
    await waitFor(() => expect(scanNow).toHaveBeenCalled());
  });

  it("names each Remove button after its own folder", async () => {
    getExtraScanFolders.mockResolvedValue({ status: "ok", data: ["/code/scratch", "/code/spikes"] });
    render(<FoldersTab />);
    await screen.findByText("/code/spikes");

    // Two identically-labelled "Remove" buttons are indistinguishable to a
    // screen reader; each must say which folder it drops.
    fireEvent.click(screen.getByRole("button", { name: "Remove /code/spikes" }));

    await waitFor(() => expect(setExtraScanFolders).toHaveBeenCalledWith(["/code/scratch"]));
  });

  it("shows an empty-state message when there are no extra folders", async () => {
    getExtraScanFolders.mockResolvedValue({ status: "ok", data: [] });
    render(<FoldersTab />);
    expect(
      await screen.findByText("No extra folders — every detected agent harness is scanned already."),
    ).toBeInTheDocument();
  });

  it("Add folder prompts for a directory, appends it, and rescans", async () => {
    open.mockResolvedValue("/code/new-folder");
    render(<FoldersTab />);
    await screen.findByText("/code/scratch");

    fireEvent.click(screen.getByRole("button", { name: "Add folder…" }));

    await waitFor(() => expect(open).toHaveBeenCalled());
    await waitFor(() =>
      expect(setExtraScanFolders).toHaveBeenCalledWith(["/code/scratch", "/code/new-folder"]),
    );
    await waitFor(() => expect(scanNow).toHaveBeenCalled());
  });

  it("does nothing when the folder dialog is cancelled", async () => {
    open.mockResolvedValue(null);
    render(<FoldersTab />);
    await screen.findByText("/code/scratch");

    fireEvent.click(screen.getByRole("button", { name: "Add folder…" }));

    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(setExtraScanFolders).not.toHaveBeenCalled();
    expect(scanNow).not.toHaveBeenCalled();
  });
});

describe("FoldersTab removal", () => {
  // The frontend never counts this itself — it asks `previewFolderRemoval`,
  // the same backend rule `set_extra_scan_folders` applies, and renders
  // whatever it says. `data` is just an array of that length; the ids in it
  // are never read.
  const withPreview = (n: number) =>
    previewFolderRemoval.mockResolvedValue({ status: "ok", data: Array.from({ length: n }, (_, i) => `p${i}`) });

  it("asks first, with the count, when the removal deletes projects", async () => {
    withPreview(2);
    render(<FoldersTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove /code/scratch" }));
    expect(await screen.findByRole("alertdialog", { name: "Remove /code/scratch" })).toHaveTextContent(
      "Removes 2 projects and their history from Prompt Janitor. Files on disk are not touched.",
    );
    expect(setExtraScanFolders).not.toHaveBeenCalled();
    expect(previewFolderRemoval).toHaveBeenCalledWith([]);
  });

  it("uses the singular for one project", async () => {
    withPreview(1);
    render(<FoldersTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove /code/scratch" }));
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(
      "Removes 1 project and its history from Prompt Janitor. Files on disk are not touched.",
    );
  });

  it("removes the folder on confirm", async () => {
    withPreview(1);
    render(<FoldersTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove /code/scratch" }));
    fireEvent.click(await screen.findByRole("button", { name: "Remove folder" }));
    await waitFor(() => expect(setExtraScanFolders).toHaveBeenCalledWith([]));
  });

  it("cancel removes nothing", async () => {
    withPreview(1);
    render(<FoldersTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove /code/scratch" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(setExtraScanFolders).not.toHaveBeenCalled();
  });

  // Fail closed: when the backend can't say what would go, the folder is never
  // removed straight away — the user still gets a (generic) confirmation.
  it("still asks, with a generic warning, when the preview errors", async () => {
    previewFolderRemoval.mockResolvedValue({ status: "error", error: "db locked" });
    render(<FoldersTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove /code/scratch" }));
    expect(await screen.findByRole("alertdialog", { name: "Remove /code/scratch" })).toHaveTextContent(
      "Removing this folder deletes its projects and their history from Prompt Janitor. Files on disk are not touched.",
    );
    expect(setExtraScanFolders).not.toHaveBeenCalled();
  });

  it("still asks, with a generic warning, when the preview invoke rejects", async () => {
    previewFolderRemoval.mockRejectedValue(new Error("ipc down"));
    render(<FoldersTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove /code/scratch" }));
    expect(await screen.findByRole("alertdialog", { name: "Remove /code/scratch" })).toHaveTextContent(
      "Removing this folder deletes its projects and their history",
    );
    expect(setExtraScanFolders).not.toHaveBeenCalled();
  });

  it("removes at once, with no confirmation, when no project would go", async () => {
    withPreview(0);
    render(<FoldersTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove /code/scratch" }));
    await waitFor(() => expect(setExtraScanFolders).toHaveBeenCalledWith([]));
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });
});

describe("FoldersTab rescan", () => {
  it("Scan calls scanNow", async () => {
    render(<FoldersTab />);
    await screen.findByText("/code/scratch");

    fireEvent.click(screen.getByRole("button", { name: "Scan" }));

    await waitFor(() => expect(scanNow).toHaveBeenCalled());
  });

  it("refetches harnesses and folders when a scan finishes elsewhere", async () => {
    render(<FoldersTab />);
    await screen.findByText("/code/scratch");
    expect(listHarnesses).toHaveBeenCalledTimes(1);

    await act(async () => {
      listeners.get("scan-done")?.();
    });

    await waitFor(() => expect(listHarnesses).toHaveBeenCalledTimes(2));
  });
});

describe("FoldersTab a11y", () => {
  it("has no obvious accessibility violations", async () => {
    const { container } = render(<FoldersTab />);
    await screen.findByText("/code/scratch");
    expect(await axe(container)).toHaveNoViolations();
  });
});
