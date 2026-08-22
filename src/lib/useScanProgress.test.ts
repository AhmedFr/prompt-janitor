import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScanProgress } from "./useScanProgress";

const listeners = vi.hoisted(() => new Map<string, (e: { payload: unknown }) => void>());
const unlisten = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, isTauri: true };
});

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: (e: { payload: unknown }) => void) => {
    listeners.set(event, handler);
    return Promise.resolve(() => {
      listeners.delete(event);
      unlisten(event);
    });
  }),
}));

const emit = (event: string, payload: unknown) =>
  act(() => {
    listeners.get(event)?.({ payload });
  });

beforeEach(() => {
  listeners.clear();
  unlisten.mockClear();
});

describe("useScanProgress", () => {
  it("starts with nothing known about the scan", () => {
    const { result } = renderHook(() => useScanProgress());
    expect(result.current).toEqual({ phase: null, progress: null });
  });

  it("tracks the phase and the file counter as the core reports them", () => {
    const { result } = renderHook(() => useScanProgress());

    emit("scan-phase", "harness");
    expect(result.current.phase).toBe("harness");

    emit("scan-phase", "files");
    emit("scan-progress", { done: 7, total: 20 });
    expect(result.current).toEqual({ phase: "files", progress: { done: 7, total: 20 } });
  });

  it("unsubscribes from both events on unmount", async () => {
    const { unmount } = renderHook(() => useScanProgress());
    unmount();

    // The unlisten handles are promises; let them settle before asserting.
    await act(async () => {});
    expect(unlisten.mock.calls.map(([e]) => e).sort()).toEqual(["scan-phase", "scan-progress"]);
    expect(listeners.size).toBe(0);
  });
});
