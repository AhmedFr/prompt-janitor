import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { SetupTarget } from "@/App/setupTarget";
import type { SetupRow } from "./setupRows.util";
import { useOpenItem } from "./useOpenItem";
import { useSetupTarget } from "./useSetupTarget";

afterEach(cleanup);

const row = (id: number, file_id: string | null = null): SetupRow => ({
  id, harness: "claude_code", layer: "global", kind: "skill", name: `r${id}`, path: `/r${id}`, plugin_name: null,
  description: null, bytes: 0, grade: null, score: null, file_id, usage: null, issue_count: null,
  worst_severity: null, origin: "inventory", project_label: null, project_path: null, load_order: null,
});
const rows = [row(1), row(2, "f-2"), row(3)];

type Props = { rows: SetupRow[]; target?: SetupTarget; loading: boolean };
const render = (initialProps: Props) =>
  renderHook(({ rows, target, loading }: Props) => useOpenItem(rows, useSetupTarget(target), loading), { initialProps });

describe("useOpenItem", () => {
  it("opens a clicked row on Content and closes", () => {
    const { result } = render({ rows, loading: false });
    act(() => result.current.openRow(rows[1]));
    expect(result.current.open?.id).toBe(2);
    expect(result.current.tab).toBe("content");
    act(() => result.current.close());
    expect(result.current.open).toBeNull();
  });

  it("opens a deep link's item on its tab, by artifact or by file id", () => {
    expect(render({ rows, loading: false, target: { open: { artifactId: 3 }, tab: "usage" } }).result.current).toMatchObject({ open: { id: 3 }, tab: "usage" });
    expect(render({ rows, loading: false, target: { open: { fileId: "f-2" } } }).result.current.open?.id).toBe(2);
  });

  it("waits for a linked item's rows while loading", () => {
    const target = { open: { artifactId: 9 } };
    const { result, rerender } = render({ rows, loading: true, target });
    expect(result.current.open).toBeNull();
    rerender({ rows: [...rows, row(9)], loading: true, target });
    expect(result.current.open?.id).toBe(9);
  });

  it("drops a linked item still missing once the load is done, so a later refresh does not pop it open", () => {
    const target = { open: { artifactId: 9 } };
    const { result, rerender } = render({ rows, loading: true, target });
    rerender({ rows, loading: false, target });
    rerender({ rows: [...rows, row(9)], loading: false, target });
    expect(result.current.open).toBeNull();
  });

  it("closes for good when its row leaves the rows", () => {
    const { result, rerender } = render({ rows, loading: false });
    act(() => result.current.openRow(rows[0]));
    rerender({ rows: rows.slice(1), loading: false });
    expect(result.current.open).toBeNull();
    rerender({ rows, loading: false });
    expect(result.current.open).toBeNull();
  });

  it("steps through the visible ids and stops at the ends", () => {
    const { result } = render({ rows, loading: false });
    act(() => result.current.setVisibleIds(["1", "3"]));
    act(() => result.current.openRow(rows[0]));
    act(() => result.current.step(1));
    expect(result.current.open?.id).toBe(3);
    act(() => result.current.step(1));
    expect(result.current.open?.id).toBe(3);
  });

  it("opens a file's findings from a file link", () => {
    const { result } = render({ rows, loading: false });
    act(() => result.current.openFindings("f-2"));
    expect(result.current).toMatchObject({ open: { id: 2 }, tab: "findings" });
  });

  it("reports opening as a push, and the tab and a step as replaces, over the rest of the target", () => {
    const change = vi.fn();
    const value: SetupTarget = { kind: "skill", open: { artifactId: 1 } };
    const { result } = renderHook(() => useOpenItem(rows, { value, change }, false));
    act(() => result.current.setVisibleIds(["1", "2", "3"]));
    act(() => result.current.openRow(rows[2]));
    expect(change).toHaveBeenLastCalledWith({ kind: "skill", open: { artifactId: 3 }, tab: "content" }, "push");
    act(() => result.current.setTab("usage"));
    expect(change).toHaveBeenLastCalledWith({ kind: "skill", open: { artifactId: 1 }, tab: "usage" }, "replace");
    act(() => result.current.step(1));
    expect(change).toHaveBeenLastCalledWith({ kind: "skill", open: { artifactId: 2 } }, "replace");
  });

  it("closes through the shell alone when it has one", () => {
    const change = vi.fn();
    const onCloseItem = vi.fn();
    const { result } = renderHook(() => useOpenItem(rows, { value: { open: { artifactId: 1 } }, change }, false, onCloseItem));
    act(() => result.current.close());
    expect(onCloseItem).toHaveBeenCalledTimes(1);
    expect(change).not.toHaveBeenCalled();
  });

  it("keeps openFindings stable across target changes", () => {
    const { result } = render({ rows, loading: false });
    const first = result.current.openFindings;
    act(() => result.current.openRow(rows[0]));
    expect(result.current.openFindings).toBe(first);
  });
});
