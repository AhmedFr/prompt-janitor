import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { Onboarding } from "./Onboarding";

const open = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn().mockResolvedValue(() => {}) }));

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
  session_count: 0,
});

const scanButton = () => screen.getByRole("button", { name: /run first scan/i });

beforeEach(() => {
  vi.clearAllMocks();
  listHarnesses.mockResolvedValue({ status: "ok", data: [harness(true)] });
  getExtraScanFolders.mockResolvedValue({ status: "ok", data: [] });
  setExtraScanFolders.mockResolvedValue({ status: "ok", data: null });
  // Failing the scan drops straight back to the app, which keeps these cases
  // on the first screen instead of the reveal.
  scanNow.mockResolvedValue({ status: "error", error: "no" });
});

afterEach(cleanup);

describe("Onboarding", () => {
  it("scans a detected harness without asking for a folder", async () => {
    const onDone = vi.fn();
    render(<Onboarding onDone={onDone} />);

    await waitFor(() => expect(scanButton()).toBeEnabled());
    await act(async () => {
      fireEvent.click(scanButton());
    });

    await waitFor(() => expect(scanNow).toHaveBeenCalled());
    expect(setExtraScanFolders).not.toHaveBeenCalled();
  });

  it("still needs a folder when no harness was detected", async () => {
    listHarnesses.mockResolvedValue({ status: "ok", data: [harness(false)] });
    render(<Onboarding onDone={vi.fn()} />);

    await waitFor(() => expect(listHarnesses).toHaveBeenCalled());
    expect(scanButton()).toBeDisabled();
  });

  it("appends a picked folder to the ones already configured", async () => {
    open.mockResolvedValue("/work/notes");
    getExtraScanFolders.mockResolvedValue({ status: "ok", data: ["/work/old"] });
    render(<Onboarding onDone={vi.fn()} />);

    await waitFor(() => expect(scanButton()).toBeEnabled());
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /add a folder/i }));
    });
    await screen.findByText("/work/notes");
    await act(async () => {
      fireEvent.click(scanButton());
    });

    await waitFor(() =>
      expect(setExtraScanFolders).toHaveBeenCalledWith(["/work/old", "/work/notes"]),
    );
  });
});
