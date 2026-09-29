import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
const getOverview = vi.hoisted(() => vi.fn());
const listeners = vi.hoisted(() => new Map<string, () => void>());
vi.mock("@/lib/ipc", async () => ({
  ...(await vi.importActual<object>("@/lib/ipc")),
  isTauri: true,
  commands: { getOverview },
}));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (event: string, handler: () => void) => {
    listeners.set(event, handler);
    return () => listeners.delete(event);
  }),
}));
import { useOverallGrade } from "./useOverallGrade";

const overview = (has_data: boolean, overall_grade: string) => ({ status: "ok", data: { has_data, overall_grade } });

beforeEach(() => {
  listeners.clear();
  getOverview.mockReset();
});

afterEach(cleanup);

describe("useOverallGrade", () => {
  it("reads the grade", async () => {
    getOverview.mockResolvedValue(overview(true, "B"));
    const { result } = renderHook(() => useOverallGrade());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.grade).toBe("B");
  });

  it("has no grade before the first scan", async () => {
    getOverview.mockResolvedValue(overview(false, "F"));
    const { result } = renderHook(() => useOverallGrade());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.grade).toBeNull();
  });

  it("has no grade when the query fails", async () => {
    getOverview.mockResolvedValue({ status: "error", error: "db busy" });
    const { result } = renderHook(() => useOverallGrade());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.grade).toBeNull();
  });

  it("refetches when a scan finishes", async () => {
    getOverview.mockResolvedValueOnce(overview(false, "F")).mockResolvedValueOnce(overview(true, "A"));
    const { result } = renderHook(() => useOverallGrade());
    await waitFor(() => expect(listeners.has("scan-done")).toBe(true));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.grade).toBeNull();
    await act(async () => listeners.get("scan-done")?.());
    await waitFor(() => expect(result.current.grade).toBe("A"));
    expect(getOverview).toHaveBeenCalledTimes(2);
  });
});
