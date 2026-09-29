import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
const getAnalytics = vi.hoisted(() => vi.fn());
const collectFixes = vi.hoisted(() => vi.fn());
const autoFixAll = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", async () => ({ ...(await vi.importActual<object>("@/lib/ipc")), isTauri: true, commands: { getAnalytics } }));
vi.mock("@/lib/autoFixAll", () => ({ collectFixes, autoFixAll }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
import { listen } from "@tauri-apps/api/event";
import { useGradePopover } from "./useGradePopover";

beforeEach(() => {
  vi.clearAllMocks();
  getAnalytics.mockResolvedValue({ status: "ok", data: { trend: [{ t: "1", score: 70 }], open_issues: 12 } });
  collectFixes.mockResolvedValue([{ fileId: "/a", edits: [{ from: "a", to: "b" }, { from: "c", to: "d" }] }]);
  autoFixAll.mockResolvedValue({ files: 1, edits: 2, failed: 0 });
});

describe("useGradePopover", () => {
  it("loads nothing until the popover opens", () => {
    renderHook(() => useGradePopover(false));
    expect(getAnalytics).not.toHaveBeenCalled();
    expect(collectFixes).not.toHaveBeenCalled();
  });

  it("counts fixable edits through collectFixes when open", async () => {
    const { result } = renderHook(() => useGradePopover(true));
    await waitFor(() => expect(result.current.fixable).toBe(2));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({ openFindings: 12, fixable: 2 });
    expect(getAnalytics).toHaveBeenCalledWith(90);
  });

  it("runs the fix through autoFixAll, then reloads", async () => {
    const { result } = renderHook(() => useGradePopover(true));
    await waitFor(() => expect(result.current.fixable).toBe(2));
    await act(async () => expect(await result.current.runFix()).toEqual({ files: 1, edits: 2, failed: 0 }));
    expect(autoFixAll).toHaveBeenCalledTimes(1);
    expect(collectFixes).toHaveBeenCalledTimes(2);
  });

  it("reports a load failure as an error, not as zero findings", async () => {
    getAnalytics.mockRejectedValue(new Error("db locked"));
    const { result } = renderHook(() => useGradePopover(true));
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.openFindings).toBe(0);
  });

  it("reads as loading, not as zeros, on first open", async () => {
    const { result } = renderHook(() => useGradePopover(true));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("reloads on scan-done while open", async () => {
    let fire: () => void = () => {};
    vi.mocked(listen).mockImplementation((async (_e: string, cb: () => void) => {
      fire = cb;
      return () => {};
    }) as never);
    const { result } = renderHook(() => useGradePopover(true));
    await waitFor(() => expect(result.current.fixable).toBe(2));
    await waitFor(() => expect(fire).not.toBe(undefined));
    await act(async () => fire());
    await waitFor(() => expect(getAnalytics).toHaveBeenCalledTimes(2));
  });
});
