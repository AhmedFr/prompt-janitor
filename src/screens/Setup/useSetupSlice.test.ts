import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import type { SetupTarget } from "@/App/setupTarget";
import { populated } from "./setup.fixtures";
import { setupRows } from "./setupRows.util";
import { useSetupSlice } from "./useSetupSlice";

afterEach(cleanup);

const rows = setupRows(populated, []);
const render = (target?: SetupTarget) =>
  renderHook(({ t }) => useSetupSlice(rows, t), { initialProps: { t: target } });

describe("useSetupSlice", () => {
  it("starts on every row and counts each kind", () => {
    const { result } = render();
    expect(result.current.kind).toBe("all");
    expect(result.current.visible).toHaveLength(rows.length);
    expect(result.current.kindCounts).toMatchObject({ all: rows.length, skill: 5 });
  });

  it("starts from a deep link's kind and filter, and follows a later one", () => {
    const { result, rerender } = render({ kind: "skill", filter: "never" });
    expect(result.current.ofKind.every((r) => r.kind === "skill")).toBe(true);
    expect(result.current.visible.every((r) => r.usage === null)).toBe(true);
    rerender({ t: { kind: "mcp_server" } });
    expect(result.current.kind).toBe("mcp_server");
  });

  it("clears the chip and the status filter together", () => {
    const { result } = render({ kind: "skill", filter: "never" });
    act(() => result.current.clearSlice());
    expect(result.current).toMatchObject({ kind: "all", filter: "all" });
  });
});
