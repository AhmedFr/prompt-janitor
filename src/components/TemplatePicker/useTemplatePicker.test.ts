import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import type { TemplateInfo } from "@/lib/ipc";
import { useTemplatePicker } from "./useTemplatePicker";

const open = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));

const listTemplates = vi.hoisted(() => vi.fn());
const getEntitlement = vi.hoisted(() => vi.fn());
const scanNow = vi.hoisted(() => vi.fn());
const listFiles = vi.hoisted(() => vi.fn());
const applyTemplate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return {
    ...actual,
    isTauri: true,
    commands: { listTemplates, getEntitlement, scanNow, listFiles, applyTemplate },
  };
});

const catalog: TemplateInfo[] = [
  {
    id: "rust-claude",
    stack: "rust",
    file_type: "CLAUDE.md",
    title: "Rust — CLAUDE.md",
    description: "…",
    preview: "…",
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  listTemplates.mockResolvedValue(catalog);
  getEntitlement.mockResolvedValue({ status: "ok", data: { paid: true, email: null, plan: null } });
  scanNow.mockResolvedValue({ status: "ok", data: {} });
});

describe("useTemplatePicker", () => {
  it("loads the catalog and entitlement on mount", async () => {
    const { result } = renderHook(() => useTemplatePicker());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.templates).toEqual(catalog);
    expect(result.current.entitled).toBe(true);
  });

  it("returns cancelled without calling apply_template when the folder picker is dismissed", async () => {
    open.mockResolvedValue(null);
    const { result } = renderHook(() => useTemplatePicker());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const outcome = await act(() => result.current.applyTemplate("rust-claude"));
    expect(outcome).toEqual({ status: "cancelled" });
    expect(applyTemplate).not.toHaveBeenCalled();
    expect(scanNow).not.toHaveBeenCalled();
  });

  it("surfaces the backend error (e.g. the paid gate or an existing file) without rescanning", async () => {
    open.mockResolvedValue("/demo/project");
    applyTemplate.mockResolvedValue({ status: "error", error: "CLAUDE.md already exists there." });
    const { result } = renderHook(() => useTemplatePicker());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const outcome = await act(() => result.current.applyTemplate("rust-claude"));
    expect(outcome).toEqual({ status: "error", message: "CLAUDE.md already exists there." });
    expect(scanNow).not.toHaveBeenCalled();
  });

  it("rescans and resolves the new file's id by matching its exact written path", async () => {
    open.mockResolvedValue("/demo/project");
    applyTemplate.mockResolvedValue({ status: "ok", data: { path: "/demo/project/CLAUDE.md" } });
    listFiles.mockResolvedValue({
      status: "ok",
      data: [
        { id: "f1", name: "CLAUDE.md", path: "/demo/project/CLAUDE.md", project: "project", grade: "A", score: 100, issue_count: 0, modified: null },
        { id: "f2", name: "AGENTS.md", path: "/demo/other/AGENTS.md", project: "other", grade: "A", score: 100, issue_count: 0, modified: null },
      ],
    });
    const { result } = renderHook(() => useTemplatePicker());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const outcome = await act(() => result.current.applyTemplate("rust-claude"));
    expect(scanNow).toHaveBeenCalledWith();
    expect(outcome).toEqual({ status: "done", path: "/demo/project/CLAUDE.md", fileId: "f1" });
  });

  it("resolves a null file id when the written file isn't in the scanned folder", async () => {
    open.mockResolvedValue("/outside");
    applyTemplate.mockResolvedValue({ status: "ok", data: { path: "/outside/CLAUDE.md" } });
    listFiles.mockResolvedValue({ status: "ok", data: [] });
    const { result } = renderHook(() => useTemplatePicker());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const outcome = await act(() => result.current.applyTemplate("rust-claude"));
    expect(outcome).toEqual({ status: "done", path: "/outside/CLAUDE.md", fileId: null });
  });
});
