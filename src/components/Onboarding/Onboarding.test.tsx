import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Onboarding } from "./Onboarding";

const open = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));

// One handler registry per test so a case can drive `scan-phase` / `scan-progress`.
const listeners = vi.hoisted(() => new Map<string, (e: { payload: unknown }) => void>());
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: (e: { payload: unknown }) => void) => {
    listeners.set(event, handler);
    return Promise.resolve(() => listeners.delete(event));
  }),
}));

const emit = (event: string, payload: unknown) =>
  act(() => {
    listeners.get(event)?.({ payload });
  });

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

const harness = (detected: boolean) => ({
  id: "claude_code",
  display_name: "Claude Code",
  detected,
  last_scan_at: null,
  project_count: detected ? 12 : 0,
  session_count: detected ? 88 : 0,
});

const scanButton = () => screen.getByRole("button", { name: /scan everything/i });

beforeEach(() => {
  vi.clearAllMocks();
  listeners.clear();
  listHarnesses.mockResolvedValue({ status: "ok", data: [harness(true)] });
  getExtraScanFolders.mockResolvedValue({ status: "ok", data: [] });
  setExtraScanFolders.mockResolvedValue({ status: "ok", data: null });
  // Failing the scan drops straight back to the app, which keeps these cases
  // on the first screen instead of the reveal.
  scanNow.mockResolvedValue({ status: "error", error: "no" });
  open.mockResolvedValue(null);
});

afterEach(cleanup);

describe("Onboarding", () => {
  it("scans a detected harness without asking for a folder", async () => {
    render(<Onboarding onDone={vi.fn()} />);

    await waitFor(() => expect(scanButton()).toBeEnabled());
    expect(screen.getByRole("heading", { name: "Detected: Claude Code" })).toBeInTheDocument();
    expect(screen.getByText("1 global setup · 12 projects · 88 sessions")).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(scanButton());
    });

    await waitFor(() => expect(scanNow).toHaveBeenCalled());
    expect(setExtraScanFolders).not.toHaveBeenCalled();
  });

  it("still needs a folder when no harness was detected", async () => {
    listHarnesses.mockResolvedValue({ status: "ok", data: [harness(false)] });
    render(<Onboarding onDone={vi.fn()} />);

    expect(
      await screen.findByRole("heading", { name: "No supported agent harness found" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /scan everything/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add a folder/i })).toBeEnabled();
  });

  it("appends a picked folder to the ones already configured", async () => {
    open.mockResolvedValue("/work/notes");
    getExtraScanFolders.mockResolvedValue({ status: "ok", data: ["/work/old"] });
    listHarnesses.mockResolvedValue({ status: "ok", data: [harness(false)] });
    render(<Onboarding onDone={vi.fn()} />);

    const add = await screen.findByRole("button", { name: /add a folder/i });
    await act(async () => {
      fireEvent.click(add);
    });

    await waitFor(() =>
      expect(setExtraScanFolders).toHaveBeenCalledWith(["/work/old", "/work/notes"]),
    );
    expect(scanNow).toHaveBeenCalled();
  });

  it("narrates the scan phases while it runs", async () => {
    // Hold the scan open so the progress screen stays on-screen.
    let finish: (r: { status: "error"; error: string }) => void = () => {};
    scanNow.mockReturnValue(
      new Promise<{ status: "error"; error: string }>((resolve) => {
        finish = resolve;
      }),
    );
    render(<Onboarding onDone={vi.fn()} />);
    await waitFor(() => expect(scanButton()).toBeEnabled());

    await act(async () => {
      fireEvent.click(scanButton());
    });

    emit("scan-phase", "harness");
    expect(screen.getByText("Indexing Claude Code sessions…")).toBeInTheDocument();

    emit("scan-phase", "files");
    emit("scan-progress", { done: 7, total: 20 });
    expect(screen.getByText("Grading 7/20 files")).toBeInTheDocument();

    await act(async () => {
      finish({ status: "error", error: "no" });
    });
  });

  it("hands back to the app when the scan fails", async () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);
    await waitFor(() => expect(scanButton()).toBeEnabled());

    await act(async () => {
      fireEvent.click(scanButton());
    });

    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Onboarding onDone={vi.fn()} />);
    await waitFor(() => expect(scanButton()).toBeEnabled());

    expect(await axe(container)).toHaveNoViolations();
  });
});
