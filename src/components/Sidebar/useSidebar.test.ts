import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { ProjectRow } from "@/lib/ipc";
import { useSidebar } from "./useSidebar";

// One handler registry per test so a case can emit events like the core does.
const listeners = vi.hoisted(() => new Map<string, () => void>());
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: () => void) => {
    listeners.set(event, handler);
    return Promise.resolve(() => listeners.delete(event));
  }),
}));

const emit = async (event: string) => {
  await act(async () => {
    listeners.get(event)?.();
  });
};

const listProjects = vi.hoisted(() => vi.fn());
const listFiles = vi.hoisted(() => vi.fn());
const listRules = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, isTauri: true, commands: { listProjects, listFiles, listRules } };
});

const project = (o: Partial<ProjectRow>): ProjectRow => ({
  id: "/code/app",
  name: "app",
  grade: "B",
  score: 80,
  file_count: 1,
  issue_count: 0,
  logo: null,
  modified: null,
  harness: null,
  session_count: 0,
  last_session_at: null,
  never_used_count: 0,
  error_count: 0,
  exists: true,
  ...o,
});

const names = (result: { current: ReturnType<typeof useSidebar> }) =>
  result.current.projects.map((p) => p.name);

describe("useSidebar", () => {
  beforeEach(() => {
    listeners.clear();
    listProjects.mockResolvedValue({
      status: "ok",
      data: [project({ id: "/a", name: "api" }), project({ id: "/b", name: "blog" })],
    });
    listFiles.mockResolvedValue({ status: "ok", data: [] });
    listRules.mockResolvedValue({ status: "ok", data: [] });
  });

  it("loads the recent projects on mount", async () => {
    const { result } = renderHook(() => useSidebar());
    await waitFor(() => expect(names(result)).toEqual(["api", "blog"]));
  });

  it("refetches when a scan finishes", async () => {
    const { result } = renderHook(() => useSidebar());
    await waitFor(() => expect(names(result)).toHaveLength(2));

    listProjects.mockResolvedValue({ status: "ok", data: [project({ id: "/n", name: "new" })] });
    await emit("scan-done");

    await waitFor(() => expect(names(result)).toEqual(["new"]));
  });

  it("refetches when the project set changes outside a scan", async () => {
    const { result } = renderHook(() => useSidebar());
    await waitFor(() => expect(names(result)).toHaveLength(2));

    // Removing a scan folder drops its projects before any rescan runs.
    listProjects.mockResolvedValue({ status: "ok", data: [project({ id: "/a", name: "api" })] });
    await emit("projects-changed");

    await waitFor(() => expect(names(result)).toEqual(["api"]));
  });
});
