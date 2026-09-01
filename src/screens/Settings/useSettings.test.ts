import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSettings } from "./useSettings";

const listeners = vi.hoisted(() => new Map<string, () => void>());
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: () => void) => {
    listeners.set(event, handler);
    return Promise.resolve(() => listeners.delete(event));
  }),
}));

const ok = <T,>(data: T) => vi.fn().mockResolvedValue({ status: "ok", data });

const commands = vi.hoisted(() => ({
  getSchedule: vi.fn(),
  getAlert: vi.fn(),
  getAppStatus: vi.fn(),
  getAiConfig: vi.fn(),
  getEntitlement: vi.fn(),
}));

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, isTauri: true, commands };
});

const status = (fileCount: number) => ({
  schema_version: 10,
  db_path: "/tmp/prompt-janitor.db",
  project_count: 3,
  file_count: fileCount,
});

beforeEach(() => {
  listeners.clear();
  commands.getSchedule = ok("6h");
  commands.getAlert = ok(true);
  commands.getAppStatus = ok(status(42));
  commands.getAiConfig = ok({ provider: "none", model: "", has_key: false });
  commands.getEntitlement = ok({ paid: true, email: null, plan: "open" });
});

describe("useSettings", () => {
  it("loads the persisted settings on mount", async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.schedule).toBe("6h");
    expect(result.current.status?.file_count).toBe(42);
  });

  /**
   * The About panel's counts come from the database, and a reset or a scan
   * rewrites it. Every other screen refetches on `scan-done`; Settings sat on
   * whatever it read at mount and showed a file count that no longer existed.
   */
  it("refetches when a scan finishes", async () => {
    const { result } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));

    commands.getAppStatus = ok(status(0));
    await act(async () => {
      listeners.get("scan-done")?.();
    });

    await waitFor(() => expect(result.current.status?.file_count).toBe(0));
  });

  it("stops listening once unmounted", async () => {
    const { result, unmount } = renderHook(() => useSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(listeners.has("scan-done")).toBe(true));
    unmount();
    await waitFor(() => expect(listeners.has("scan-done")).toBe(false));
  });
});
