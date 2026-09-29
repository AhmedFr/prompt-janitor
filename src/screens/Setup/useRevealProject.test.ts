import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";

const revealProject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", async () => ({
  ...(await vi.importActual<object>("@/lib/ipc")),
  commands: { revealProject },
}));
import { useRevealProject } from "./useRevealProject";

afterEach(cleanup);
beforeEach(() => {
  revealProject.mockReset();
  revealProject.mockResolvedValue({ status: "ok", data: null });
});

describe("useRevealProject", () => {
  it("reveals the project's folder and has nothing to say when it works", async () => {
    const { result } = renderHook(() => useRevealProject("/repo/web"));
    await act(() => result.current.reveal());
    expect(revealProject).toHaveBeenCalledWith("/repo/web");
    expect(result.current.error).toBeNull();
  });

  it("keeps the reason a reveal failed", async () => {
    revealProject.mockResolvedValue({ status: "error", error: "no Finder" });
    const { result } = renderHook(() => useRevealProject("/repo/web"));
    await act(() => result.current.reveal());
    expect(result.current.error).toBe("no Finder");
  });

  it("keeps the reason when the command itself throws", async () => {
    revealProject.mockRejectedValue(new Error("ipc down"));
    const { result } = renderHook(() => useRevealProject("/repo/web"));
    await act(() => result.current.reveal());
    expect(result.current.error).toBe("ipc down");
  });

  it("drops the error when the lens moves to another project", async () => {
    revealProject.mockResolvedValue({ status: "error", error: "no Finder" });
    const { result, rerender } = renderHook(({ p }) => useRevealProject(p), { initialProps: { p: "/repo/web" } });
    await act(() => result.current.reveal());
    rerender({ p: "/repo/api" });
    expect(result.current.error).toBeNull();
  });

  it("does nothing without a project", async () => {
    const { result } = renderHook(() => useRevealProject(null));
    await act(() => result.current.reveal());
    expect(revealProject).not.toHaveBeenCalled();
  });
});

describe("useRevealProject — a late answer", () => {
  it("drops a failure that lands after the lens moved on", async () => {
    let answer: (v: unknown) => void = () => {};
    revealProject.mockReturnValue(new Promise((r) => (answer = r)));
    const { result, rerender } = renderHook(({ p }) => useRevealProject(p), { initialProps: { p: "/repo/web" } });
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.reveal();
    });
    rerender({ p: "/repo/api" });
    await act(async () => {
      answer({ status: "error", error: "no Finder" });
      await pending;
    });
    expect(result.current.error).toBeNull();
  });
});
