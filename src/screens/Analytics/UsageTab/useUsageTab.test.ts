import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { UsageOverview } from "@/lib/ipc";
import { useUsageTab } from "./useUsageTab";

const overview = (window_days: number): UsageOverview => ({
  window_days,
  ranked: [],
  by_kind: [{ kind: "skill", total: 3, avg_turn_tokens: null }],
  sessions_per_project: [],
  mcp_error_rates: [],
});

const getUsageOverview = vi.hoisted(() =>
  vi.fn(
    async (windowDays: number): Promise<{ status: "ok"; data: UsageOverview }> => ({
      status: "ok",
      data: {
        window_days: windowDays,
        ranked: [],
        by_kind: [],
        sessions_per_project: [],
        mcp_error_rates: [],
      },
    }),
  ),
);
const listeners = vi.hoisted(() => new Map<string, () => void>());

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, isTauri: true, commands: { getUsageOverview } };
});

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: () => void) => {
    listeners.set(event, handler);
    return Promise.resolve(() => listeners.delete(event));
  }),
}));

beforeEach(() => {
  listeners.clear();
  getUsageOverview.mockClear();
  getUsageOverview.mockImplementation(async (windowDays: number) => ({
    status: "ok" as const,
    data: overview(windowDays),
  }));
});

describe("useUsageTab", () => {
  it("loads the overview for the window it was given", async () => {
    const { result } = renderHook(() => useUsageTab(7));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getUsageOverview).toHaveBeenCalledWith(7);
    expect(result.current.data?.window_days).toBe(7);
  });

  it("refetches when the window changes", async () => {
    const { result, rerender } = renderHook(({ days }) => useUsageTab(days), {
      initialProps: { days: 7 },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ days: 90 });

    await waitFor(() => expect(result.current.data?.window_days).toBe(90));
    expect(getUsageOverview).toHaveBeenLastCalledWith(90);
  });

  /**
   * The reads outlive the window they were started for: switching 7d → 90d
   * leaves the 7d read in flight, and without a generation gate it lands last
   * and wins — painting a week of usage under a toolbar that says 90d.
   */
  it("discards a superseded window's read even when it answers last", async () => {
    const pending = new Map<number, (data: UsageOverview) => void>();
    getUsageOverview.mockImplementation(
      (windowDays: number) =>
        new Promise((resolve) => {
          pending.set(windowDays, (data) => resolve({ status: "ok", data }));
        }),
    );

    const { result, rerender } = renderHook(({ days }) => useUsageTab(days), {
      initialProps: { days: 7 },
    });
    await waitFor(() => expect(pending.has(7)).toBe(true));

    rerender({ days: 90 });
    await waitFor(() => expect(pending.has(90)).toBe(true));

    // The current window answers first, the superseded one after it.
    await act(async () => pending.get(90)?.(overview(90)));
    await act(async () => pending.get(7)?.(overview(7)));

    expect(result.current.data?.window_days).toBe(90);
    expect(result.current.loading).toBe(false);
  });

  it("refetches the same window when a scan re-indexes the transcripts", async () => {
    const { result } = renderHook(() => useUsageTab(30));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(listeners.has("scan-done")).toBe(true));

    await act(async () => listeners.get("scan-done")?.());

    expect(getUsageOverview).toHaveBeenCalledTimes(2);
    expect(getUsageOverview).toHaveBeenLastCalledWith(30);
  });
});
