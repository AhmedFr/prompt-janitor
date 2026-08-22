import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTableState } from "./useTableState";
import type { TableState } from "./DataTable.types";

const initial: TableState = { search: "", pills: {}, sort: null };

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("useTableState", () => {
  it("starts from the caller's initial state when nothing is stored", () => {
    const { result } = renderHook(() => useTableState("setup", initial));
    expect(result.current[0]).toEqual(initial);
  });

  it("merges a patch into the current state rather than replacing it", () => {
    const { result } = renderHook(() => useTableState("setup", initial));

    act(() => result.current[1]({ search: "web" }));
    expect(result.current[0]).toEqual({ search: "web", pills: {}, sort: null });

    act(() => result.current[1]({ pills: { kind: ["rule"] } }));
    expect(result.current[0]).toEqual({
      search: "web",
      pills: { kind: ["rule"] },
      sort: null,
    });
  });

  it("persists patched state to sessionStorage under pj.table.<key>", () => {
    const { result } = renderHook(() => useTableState("setup", initial));

    act(() => result.current[1]({ search: "web", sort: { id: "name", desc: true } }));

    const stored = window.sessionStorage.getItem("pj.table.setup");
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored as string)).toEqual({
      search: "web",
      pills: {},
      sort: { id: "name", desc: true },
    });
  });

  it("rehydrates from sessionStorage on mount", () => {
    window.sessionStorage.setItem(
      "pj.table.setup",
      JSON.stringify({ search: "prior", pills: { kind: ["rule"] }, sort: null }),
    );

    const { result } = renderHook(() => useTableState("setup", initial));
    expect(result.current[0]).toEqual({
      search: "prior",
      pills: { kind: ["rule"] },
      sort: null,
    });
  });

  it("keys storage per table so two tables don't clobber each other", () => {
    const a = renderHook(() => useTableState("setup", initial));
    const b = renderHook(() => useTableState("prompts", initial));

    act(() => a.result.current[1]({ search: "a" }));
    act(() => b.result.current[1]({ search: "b" }));

    expect(window.sessionStorage.getItem("pj.table.setup")).toContain("\"a\"");
    expect(window.sessionStorage.getItem("pj.table.prompts")).toContain("\"b\"");
  });

  it("reset() clears storage and restores the caller's initial state", () => {
    const { result } = renderHook(() => useTableState("setup", initial));

    act(() => result.current[1]({ search: "web" }));
    expect(window.sessionStorage.getItem("pj.table.setup")).not.toBeNull();

    act(() => result.current[2]());
    expect(result.current[0]).toEqual(initial);
    expect(window.sessionStorage.getItem("pj.table.setup")).toBeNull();
  });

  it("ignores corrupt JSON in storage and falls back to the initial state", () => {
    window.sessionStorage.setItem("pj.table.setup", "{not json");

    const { result } = renderHook(() => useTableState("setup", initial));
    expect(result.current[0]).toEqual(initial);
  });

  it("ignores a stored value with the wrong shape and falls back to the initial state", () => {
    window.sessionStorage.setItem("pj.table.setup", JSON.stringify({ search: 42 }));

    const { result } = renderHook(() => useTableState("setup", initial));
    expect(result.current[0]).toEqual(initial);
  });

  it("rejects a stored sort that isn't a well-formed column reference", () => {
    window.sessionStorage.setItem(
      "pj.table.setup",
      JSON.stringify({ search: "", pills: {}, sort: { id: "name" } }),
    );

    const { result } = renderHook(() => useTableState("setup", initial));
    expect(result.current[0]).toEqual(initial);
  });

  it("rejects a stored sort whose direction isn't a boolean", () => {
    window.sessionStorage.setItem(
      "pj.table.setup",
      JSON.stringify({ search: "", pills: {}, sort: { id: "name", desc: "yes" } }),
    );

    const { result } = renderHook(() => useTableState("setup", initial));
    expect(result.current[0]).toEqual(initial);
  });

  it("accepts a stored sort that is a well-formed column reference", () => {
    window.sessionStorage.setItem(
      "pj.table.setup",
      JSON.stringify({ search: "", pills: {}, sort: { id: "name", desc: true } }),
    );

    const { result } = renderHook(() => useTableState("setup", initial));
    expect(result.current[0].sort).toEqual({ id: "name", desc: true });
  });
});
