import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import { HarnessTab } from "./HarnessTab";
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

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return {
    ...actual,
    isTauri: true,
    commands: { listHarnesses, getExtraScanFolders, setExtraScanFolders, scanNow },
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
  open.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("HarnessTab rows", () => {
  it("lists each registered harness as detected or not detected", async () => {
    render(<HarnessTab />);
    expect(await screen.findByText("Claude Code — detected · 32 projects · 177 sessions")).toBeInTheDocument();
    expect(screen.getByText("Cursor — not detected")).toBeInTheDocument();
  });

  it("shows a relative last-scanned time only for the detected harness", async () => {
    const recent: HarnessInfo[] = [
      { ...harnesses[0], last_scan_at: new Date(Date.now() - 5 * 60_000).toISOString() },
      harnesses[1],
    ];
    listHarnesses.mockResolvedValue({ status: "ok", data: recent });

    render(<HarnessTab />);

    expect(await screen.findByText(/^last scanned \d+m ago$/)).toBeInTheDocument();
    expect(screen.queryByText("Cursor — not detected")?.parentElement?.textContent).not.toMatch(
      /last scanned/,
    );
  });
});

describe("HarnessTab extra folders", () => {
  it("lists extra folders with a Remove button that drops the path", async () => {
    render(<HarnessTab />);
    expect(await screen.findByText("/code/scratch")).toBeInTheDocument();

    getExtraScanFolders.mockResolvedValue({ status: "ok", data: [] });
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(setExtraScanFolders).toHaveBeenCalledWith([]));
    await waitFor(() => expect(scanNow).toHaveBeenCalled());
  });

  it("shows an empty-state message when there are no extra folders", async () => {
    getExtraScanFolders.mockResolvedValue({ status: "ok", data: [] });
    render(<HarnessTab />);
    expect(
      await screen.findByText("No extra folders — every detected agent harness is scanned already."),
    ).toBeInTheDocument();
  });

  it("Add folder prompts for a directory, appends it, and rescans", async () => {
    open.mockResolvedValue("/code/new-folder");
    render(<HarnessTab />);
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
    render(<HarnessTab />);
    await screen.findByText("/code/scratch");

    fireEvent.click(screen.getByRole("button", { name: "Add folder…" }));

    await waitFor(() => expect(open).toHaveBeenCalled());
    expect(setExtraScanFolders).not.toHaveBeenCalled();
    expect(scanNow).not.toHaveBeenCalled();
  });
});

describe("HarnessTab rescan", () => {
  it("Rescan now calls scanNow", async () => {
    render(<HarnessTab />);
    await screen.findByText("/code/scratch");

    fireEvent.click(screen.getByRole("button", { name: "Rescan now" }));

    await waitFor(() => expect(scanNow).toHaveBeenCalled());
  });

  it("refetches harnesses and folders when a scan finishes elsewhere", async () => {
    render(<HarnessTab />);
    await screen.findByText("/code/scratch");
    expect(listHarnesses).toHaveBeenCalledTimes(1);

    await act(async () => {
      listeners.get("scan-done")?.();
    });

    await waitFor(() => expect(listHarnesses).toHaveBeenCalledTimes(2));
  });
});

describe("HarnessTab a11y", () => {
  it("has no obvious accessibility violations", async () => {
    const { container } = render(<HarnessTab />);
    await screen.findByText("/code/scratch");
    expect(await axe(container)).toHaveNoViolations();
  });
});
