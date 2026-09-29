import { describe, expect, it, vi } from "vitest";
const calls: unknown[] = [];
vi.mock("@/lib/ipc", async () => ({
  ...(await vi.importActual<object>("@/lib/ipc")),
  commands: {
    listFiles: vi.fn(async () => ({ status: "ok", data: [{ id: "/a", issue_count: 2 }, { id: "/b", issue_count: 0 }] })),
    getFileDetail: vi.fn(async (id: string) => ({ status: "ok", data: { id, issues: [{ fix_from: "npm", fix_to: "pnpm" }, { fix_from: null, fix_to: null }] } })),
    applyFix: vi.fn(async (...args: unknown[]) => { calls.push(args); return { status: "ok", data: { git_ref: null } }; }),
    scanNow: vi.fn(async () => ({ status: "ok", data: null })),
  },
}));
import { commands } from "@/lib/ipc";
import { autoFixAll, collectFixes } from "./autoFixAll";

describe("collectFixes", () => {
  it("lists the deterministic fixes of every file with findings, applying nothing", async () => {
    calls.length = 0;
    expect(await collectFixes()).toEqual([{ fileId: "/a", edits: [{ from: "npm", to: "pnpm" }] }]);
    expect(calls).toEqual([]);
  });
});

describe("autoFixAll", () => {
  it("applies every deterministic fix on files with findings, then scans once", async () => {
    calls.length = 0;
    const result = await autoFixAll();
    expect(result).toEqual({ files: 1, edits: 1 });
    expect(calls).toEqual([["/a", [{ from: "npm", to: "pnpm" }], false, "auto"]]);
    expect(commands.scanNow).toHaveBeenCalledTimes(1);
  });
});
