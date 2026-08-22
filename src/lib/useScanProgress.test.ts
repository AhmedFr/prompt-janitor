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
    expect(result.current.phase).toBeNull();
    expect(result.current.progress).toBeNull();
  });

  it("tracks the phase and the file counter as the core reports them", () => {
    const { result } = renderHook(() => useScanProgress());

    emit("scan-phase", "harness");
    expect(result.current.phase).toBe("harness");

    emit("scan-phase", "files");
    emit("scan-progress", { done: 7, total: 20 });
    expect(result.current.phase).toBe("files");
    expect(result.current.progress).toEqual({ done: 7, total: 20 });
  });

  it("clears the stale progress counter when a new scan's harness phase starts", () => {
    const { result } = renderHook(() => useScanProgress());

    emit("scan-phase", "files");
    emit("scan-progress", { done: 7, total: 20 });
    expect(result.current.progress).toEqual({ done: 7, total: 20 });

    // A rescan starts back at "harness" — the previous run's done/total pair
    // is stale and must not linger until the first new scan-progress arrives.
    emit("scan-phase", "harness");
    expect(result.current.progress).toBeNull();
  });

  it("exposes a reset() that clears phase and progress for a caller-triggered restart", () => {
    const { result } = renderHook(() => useScanProgress());

    emit("scan-phase", "files");
    emit("scan-progress", { done: 3, total: 9 });

    act(() => result.current.reset());

    expect(result.current.phase).toBeNull();
    expect(result.current.progress).toBeNull();
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
