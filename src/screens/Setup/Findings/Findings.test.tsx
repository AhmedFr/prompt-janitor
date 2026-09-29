import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

// IPC is mocked the way Detail.test.tsx mocks it: the real IssueActions calls
// `commands.hasBackup` on mount, and an unmocked call rejects unhandled.
const getFileDetail = vi.hoisted(() => vi.fn());
const getAiConfig = vi.hoisted(() => vi.fn());
const getEntitlement = vi.hoisted(() => vi.fn());
const hasBackup = vi.hoisted(() => vi.fn());
const applyFix = vi.hoisted(() => vi.fn());
const scanNow = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, isTauri: true, commands: { getFileDetail, getAiConfig, getEntitlement, hasBackup, applyFix, scanNow } };
});
import { Findings } from "./Findings";

const detail = {
  id: "/x/CLAUDE.md", name: "CLAUDE.md", project: "x", path: "/x/CLAUDE.md", grade: "C", score: 70, content: "a\nb",
  delta: null, dimensions: [{ dimension: "Clarity", score: 50 }, { dimension: "Consistency", score: 60 },
    { dimension: "Structure", score: 90 }, { dimension: "Examples", score: 90 }, { dimension: "Format", score: 90 }],
  issues: [
    { line: 2, severity: "hi", source: "anthropic", title: "Wrong package manager", why: "Repo uses pnpm", fix_from: "npm", fix_to: "pnpm" },
    { line: null, severity: "lo", source: "custom", title: "No examples", why: "Add one", fix_from: null, fix_to: null },
  ],
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  getFileDetail.mockResolvedValue({ status: "ok", data: detail });
  getAiConfig.mockResolvedValue({ status: "ok", data: { provider: "none", has_key: false } });
  getEntitlement.mockResolvedValue({ status: "ok", data: { paid: false } });
  hasBackup.mockResolvedValue({ status: "ok", data: false });
  applyFix.mockResolvedValue({ status: "ok", data: { git_ref: null } });
  scanNow.mockResolvedValue({ status: "ok", data: { files: 1, ms: 1 } });
});

describe("Findings", () => {
  it("shows the scorecard strip and every finding", async () => {
    render(<Findings fileId="/x/CLAUDE.md" onJumpToLine={vi.fn()} />);
    expect(await screen.findByText("C · 70")).toBeInTheDocument();
    expect(screen.getByText(/Weakest on Clarity & Consistency/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Wrong package manager/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /No examples/ })).toBeInTheDocument();
  });

  it("expands the clicked finding in place, with its why and fix, without leaving the tab", async () => {
    const onJump = vi.fn();
    render(<Findings fileId="/x/CLAUDE.md" onJumpToLine={onJump} />);
    const row = await screen.findByRole("button", { name: /Wrong package manager/ });
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Repo uses pnpm")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Apply fix/ })).toBeInTheDocument();
    expect(onJump).not.toHaveBeenCalled();
  });

  it("jumps to a finding's line from its line link — the one clicked, not the first", async () => {
    const onJump = vi.fn();
    render(<Findings fileId="/x/CLAUDE.md" onJumpToLine={onJump} />);
    fireEvent.click(await screen.findByRole("button", { name: "Show line 2 in the source" }));
    expect(onJump).toHaveBeenCalledWith(2);
    expect(onJump).toHaveBeenCalledTimes(1);
  });

  it("gives a finding with no line no line link", async () => {
    render(<Findings fileId="/x/CLAUDE.md" onJumpToLine={vi.fn()} />);
    await screen.findByText("C · 70");
    expect(screen.getAllByRole("button", { name: /Show line/ })).toHaveLength(1);
  });

  it("offers Fix all automatically when a finding carries a fix", async () => {
    render(<Findings fileId="/x/CLAUDE.md" onJumpToLine={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Fix all automatically (1)" })).toBeInTheDocument();
  });

  it("says an item that is not an instruction file is not graded", () => {
    render(<Findings fileId={null} onJumpToLine={vi.fn()} />);
    expect(screen.getByText("Not graded. Checks run on instruction files only.")).toBeInTheDocument();
  });

  it("renders a story override without asking IPC", () => {
    render(
      <Findings fileId="/x/CLAUDE.md" onJumpToLine={vi.fn()}
        findings={{ detail: detail as never, loading: false, aiReady: false, entitled: true, reload: async () => {} }} />,
    );
    expect(screen.getByText("C · 70")).toBeInTheDocument();
    expect(getFileDetail).not.toHaveBeenCalled();
  });

  it("never shows purchase copy", async () => {
    render(<Findings fileId="/x/CLAUDE.md" onJumpToLine={vi.fn()} />);
    await screen.findByText("C · 70");
    fireEvent.click(screen.getByRole("button", { name: /Wrong package manager/ }));
    expect(screen.queryByText(/\$69|Get Pro|License/)).toBeNull();
  });
});
