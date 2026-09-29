import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
const getAnalytics = vi.hoisted(() => vi.fn());
const collectFixes = vi.hoisted(() => vi.fn());
const autoFixAll = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", async () => ({ ...(await vi.importActual<object>("@/lib/ipc")), isTauri: true, commands: { getAnalytics } }));
vi.mock("@/lib/autoFixAll", () => ({ collectFixes, autoFixAll }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
import { useGradePopover } from "./useGradePopover";

beforeEach(() => {
  vi.clearAllMocks();
  getAnalytics.mockResolvedValue({ status: "ok", data: { trend: [{ t: "1", score: 70 }], open_issues: 12 } });
  collectFixes.mockResolvedValue([{ fileId: "/a", edits: [{ from: "a", to: "b" }, { from: "c", to: "d" }] }]);
  autoFixAll.mockResolvedValue({ files: 1, edits: 2 });
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
    await act(async () => expect(await result.current.runFix()).toEqual({ files: 1, edits: 2 }));
    expect(autoFixAll).toHaveBeenCalledTimes(1);
    expect(collectFixes).toHaveBeenCalledTimes(2);
  });
});
