import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

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
    expect(screen.queryByText(/\$69|Get Pro|License|paid feature/i)).toBeNull();
  });

  it("fixes every finding at once, then tells the table", async () => {
    const onChanged = vi.fn();
    render(<Findings fileId="/x/CLAUDE.md" onJumpToLine={vi.fn()} onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole("button", { name: "Fix all automatically (1)" }));
    await waitFor(() => expect(applyFix).toHaveBeenCalledWith("/x/CLAUDE.md", [{ from: "npm", to: "pnpm" }], false, "auto"));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
  });

  it("says why Fix all failed", async () => {
    applyFix.mockResolvedValue({ status: "error", error: "The file changed on disk" });
    const onChanged = vi.fn();
    render(<Findings fileId="/x/CLAUDE.md" onJumpToLine={vi.fn()} onChanged={onChanged} />);
    fireEvent.click(await screen.findByRole("button", { name: "Fix all automatically (1)" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("The file changed on disk");
    expect(onChanged).not.toHaveBeenCalled();
  });

  it("offers AI checks only when a provider is set up", async () => {
    render(<Findings fileId="/x/CLAUDE.md" onJumpToLine={vi.fn()} />);
    await screen.findByText("C · 70");
    expect(screen.queryByRole("button", { name: "Run AI checks" })).toBeNull();
    cleanup();
    getAiConfig.mockResolvedValue({ status: "ok", data: { provider: "anthropic", has_key: true } });
    render(<Findings fileId="/x/CLAUDE.md" onJumpToLine={vi.fn()} />);
    expect(await screen.findByRole("button", { name: "Run AI checks" })).toBeInTheDocument();
  });

  it("does not open the next finding, or carry over its panel, once a fix removes the open one", async () => {
    getFileDetail
      .mockResolvedValueOnce({ status: "ok", data: detail })
      .mockResolvedValueOnce({ status: "ok", data: { ...detail, issues: [detail.issues[1]] } });
    render(<Findings fileId="/x/CLAUDE.md" onJumpToLine={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Wrong package manager/ }));
    fireEvent.click(screen.getByRole("button", { name: /Apply fix/ }));
    await waitFor(() => expect(screen.queryByRole("button", { name: /Wrong package manager/ })).toBeNull());
    expect(screen.getByRole("button", { name: /No examples/ })).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Applied")).toBeNull();
    expect(screen.queryByText("Add one")).toBeNull();
    expect(screen.queryByRole("button", { name: /Apply fix/ })).toBeNull();
  });

  it("closes the open finding when another file is shown", () => {
    const state = { detail: detail as never, loading: false, aiReady: false, entitled: true, reload: async () => {} };
    const { rerender } = render(<Findings fileId="/x/CLAUDE.md" onJumpToLine={vi.fn()} findings={state} />);
    fireEvent.click(screen.getByRole("button", { name: /Wrong package manager/ }));
    rerender(<Findings fileId="/y/CLAUDE.md" onJumpToLine={vi.fn()} findings={state} />);
    expect(screen.getByRole("button", { name: /Wrong package manager/ })).toHaveAttribute("aria-expanded", "false");
  });

  it("says a graded file failed to load, rather than that it is not graded, and retries", async () => {
    getFileDetail.mockResolvedValue({ status: "error", error: "database is locked" });
    render(<Findings fileId="/x/CLAUDE.md" onJumpToLine={vi.fn()} />);
    expect(await screen.findByText("Couldn't load this file's findings.")).toBeInTheDocument();
    expect(screen.queryByText(/Not graded/)).toBeNull();
    getFileDetail.mockResolvedValue({ status: "ok", data: detail });
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("C · 70")).toBeInTheDocument();
  });
});
