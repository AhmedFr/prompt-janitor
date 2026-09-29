import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { SetupTarget } from "@/App/setupTarget";
import type { FileRow } from "@/lib/ipc";
import { populated } from "./setup.fixtures";
import { useSetupLens } from "./useSetupLens";
import { useSetupTarget } from "./useSetupTarget";

afterEach(cleanup);

const graded = { id: "/side/AGENTS.md", path: "/side/AGENTS.md", project: "side", project_id: "/side" } as FileRow;
const render = (target?: SetupTarget, files: FileRow[] = []) =>
  renderHook(({ t }) => useSetupLens(useSetupTarget(t), populated, files), { initialProps: { t: target } });

describe("useSetupLens", () => {
  it("starts off with no lens and every inventory project on offer", () => {
    const { result } = render();
    expect(result.current.lens).toBeNull();
    expect(result.current.lensProject).toBeNull();
    expect(result.current.choices.map((c) => c.path)).toEqual(["/repo/web", "/repo/gone"]);
  });

  it("finds the project a deep link names, trailing slash or not, with no second option", () => {
    const { result } = render({ lens: "/repo/web/" });
    expect(result.current.lens).toBe("/repo/web");
    expect(result.current.lensProject?.name).toBe("web");
    expect(result.current.choices).toHaveLength(2);
  });

  it("trims what the Viewing control or the viewer sets, and turns off with null", () => {
    const { result } = render();
    act(() => result.current.onLens("/repo/gone//"));
    expect(result.current.lensProject?.name).toBe("gone");
    act(() => result.current.onLens(null));
    expect(result.current.lens).toBeNull();
  });

  it("follows a later deep link while mounted", () => {
    const { result, rerender } = render();
    rerender({ t: { lens: "/repo/web" } });
    expect(result.current.lensProject?.path).toBe("/repo/web");
  });

  it("keeps a graded-only lens with no project, and offers it by its graded files' name", () => {
    const { result } = render({ lens: "/side" }, [graded]);
    expect(result.current.lensProject).toBeNull();
    expect(result.current.choices[2]).toEqual({ path: "/side", name: "side", lastSessionAt: null });
  });

  it("offers nothing without an inventory", () => {
    const { result } = renderHook(() => useSetupLens({ value: { lens: "/repo/web" }, change: vi.fn() }, null, []));
    expect(result.current.lensProject).toBeNull();
    expect(result.current.choices).toEqual([]);
  });

  it("turns the lens as a new place that keeps the slice and the open item", () => {
    const change = vi.fn();
    const value: SetupTarget = { kind: "skill", open: { artifactId: 1 }, tab: "usage" };
    const { result } = renderHook(() => useSetupLens({ value, change }, populated, []));
    act(() => result.current.onLens("/repo/web/"));
    expect(change).toHaveBeenCalledWith({ kind: "skill", lens: "/repo/web", open: { artifactId: 1 }, tab: "usage" }, "push");
  });
});
