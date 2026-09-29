import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
const getArtifactUsage = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", async () => ({
  ...(await vi.importActual<object>("@/lib/ipc")),
  isTauri: true,
  commands: { getArtifactUsage },
}));
import { useItemUsage } from "./useItemUsage";

const data = { window_days: 30, per_day: [], by_project: [], avg_turn_tokens: null };

beforeEach(() => {
  getArtifactUsage.mockReset();
  getArtifactUsage.mockResolvedValue({ status: "ok", data });
});

describe("useItemUsage", () => {
  it("loads an inventory item's usage for the window", async () => {
    const { result } = renderHook(() => useItemUsage(4, 30));
    await waitFor(() => expect(result.current.usage).toEqual(data));
    expect(getArtifactUsage).toHaveBeenCalledWith(4, 30);
    expect(result.current.loading).toBe(false);
  });

  it("reloads when the window changes", async () => {
    const { rerender } = renderHook(({ days }) => useItemUsage(4, days), { initialProps: { days: 30 as 30 | 90 } });
    rerender({ days: 90 });
    await waitFor(() => expect(getArtifactUsage).toHaveBeenLastCalledWith(4, 90));
  });

  it("never asks for a graded-only row (synthetic negative id) or no item", () => {
    renderHook(() => useItemUsage(-17, 30));
    renderHook(() => useItemUsage(null, 30));
    expect(getArtifactUsage).not.toHaveBeenCalled();
  });
});
