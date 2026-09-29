import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
const getFileDetail = vi.hoisted(() => vi.fn());
const getAiConfig = vi.hoisted(() => vi.fn());
const getEntitlement = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", async () => ({
  ...(await vi.importActual<object>("@/lib/ipc")),
  isTauri: true,
  commands: { getFileDetail, getAiConfig, getEntitlement },
}));
import { useFileDetail } from "./useFileDetail";

beforeEach(() => {
  getFileDetail.mockReset();
  getFileDetail.mockResolvedValue({ status: "ok", data: { id: "/x/CLAUDE.md", issues: [] } });
  getAiConfig.mockResolvedValue({ status: "ok", data: { provider: "anthropic", has_key: true } });
  getEntitlement.mockResolvedValue({ status: "ok", data: { paid: false } });
});

describe("useFileDetail", () => {
  it("loads the file and the AI gate", async () => {
    const { result } = renderHook(() => useFileDetail("/x/CLAUDE.md"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.detail?.id).toBe("/x/CLAUDE.md");
    await waitFor(() => expect(result.current.aiReady).toBe(true));
  });

  it("is unlocked from the first render while payments are off", () => {
    const { result } = renderHook(() => useFileDetail("/x/CLAUDE.md"));
    expect(result.current.entitled).toBe(true);
  });

  it("stops loading when the file read rejects, leaving no file (the failed state)", async () => {
    getFileDetail.mockRejectedValue(new Error("ipc down"));
    const { result } = renderHook(() => useFileDetail("/x/CLAUDE.md"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.detail).toBeNull();
  });

  it("a reload that rejects settles without throwing and keeps the file shown", async () => {
    const { result } = renderHook(() => useFileDetail("/x/CLAUDE.md"));
    await waitFor(() => expect(result.current.detail?.id).toBe("/x/CLAUDE.md"));
    getFileDetail.mockRejectedValueOnce(new Error("ipc down"));
    await expect(result.current.reload()).resolves.toBeUndefined();
    expect(result.current.detail?.id).toBe("/x/CLAUDE.md");
  });

  it("keeps the AI gate closed when its reads reject", async () => {
    getAiConfig.mockRejectedValueOnce(new Error("ipc down"));
    const { result } = renderHook(() => useFileDetail("/x/CLAUDE.md"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.aiReady).toBe(false);
  });

  it("holds no file for a null id and never asks for one", async () => {
    const { result } = renderHook(() => useFileDetail(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.detail).toBeNull();
    expect(getFileDetail).not.toHaveBeenCalled();
  });
});
