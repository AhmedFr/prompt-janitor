import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
const getFileDetail = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", async () => ({
  ...(await vi.importActual<object>("@/lib/ipc")),
  isTauri: true,
  commands: { getFileDetail },
}));
import { useGradedSource } from "./useGradedSource";

beforeEach(() => getFileDetail.mockReset());

describe("useGradedSource", () => {
  it("reads a graded file's content read-only, markdown by extension", async () => {
    getFileDetail.mockResolvedValue({ status: "ok", data: { content: "# A", path: "/x/AGENTS.md" } });
    const { result } = renderHook(() => useGradedSource("/x/AGENTS.md"));
    await waitFor(() => expect(result.current.content).toBe("# A"));
    expect(result.current.format).toBe("markdown");
    expect(result.current.editable).toBe(false);
    expect(await result.current.save("x")).toBeNull();
  });

  it("reads anything else as text", async () => {
    getFileDetail.mockResolvedValue({ status: "ok", data: { content: "be terse", path: "/x/.cursorrules" } });
    const { result } = renderHook(() => useGradedSource("/x/.cursorrules"));
    await waitFor(() => expect(result.current.format).toBe("text"));
  });

  it("says so when the file left the scan", async () => {
    getFileDetail.mockResolvedValue({ status: "ok", data: null });
    const { result } = renderHook(() => useGradedSource("/gone"));
    await waitFor(() => expect(result.current.error).toBe("That file is no longer in the scan."));
  });

  it("passes a refused read through, word for word", async () => {
    getFileDetail.mockResolvedValue({ status: "error", error: "Command get_file_detail not allowed by ACL" });
    const { result } = renderHook(() => useGradedSource("/x/AGENTS.md"));
    await waitFor(() => expect(result.current.error).toBe("Command get_file_detail not allowed by ACL"));
    expect(result.current.content).toBeNull();
    expect(result.current.loading).toBe(false);
  });
});
