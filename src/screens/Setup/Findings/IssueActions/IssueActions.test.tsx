import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
const hasBackup = vi.hoisted(() => vi.fn());
const applyFix = vi.hoisted(() => vi.fn());
const undoFix = vi.hoisted(() => vi.fn());
const suggestFix = vi.hoisted(() => vi.fn());
const scanNow = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, isTauri: true, commands: { hasBackup, applyFix, undoFix, suggestFix, scanNow } };
});
import { IssueActions } from "./IssueActions";

const issue = { line: 2, severity: "hi", source: "anthropic", title: "Wrong package manager", why: "Repo uses pnpm",
  fix_from: "npm", fix_to: "pnpm" } as never;

afterEach(cleanup);

beforeEach(() => {
  hasBackup.mockResolvedValue({ status: "ok", data: false });
  applyFix.mockResolvedValue({ status: "ok", data: { git_ref: null } });
  undoFix.mockResolvedValue({ status: "ok", data: null });
  scanNow.mockResolvedValue({ status: "ok", data: { files: 1, ms: 1 } });
});

describe("IssueActions", () => {
  it("shows the why and the deterministic fix", () => {
    const { container } = render(
      <IssueActions issue={issue} fileId="/f" index={0} aiReady={false} entitled onReload={vi.fn()} />,
    );
    expect(screen.getByText("Repo uses pnpm")).toBeInTheDocument();
    expect(container.querySelector(".d-diff-to")).toHaveTextContent("+ pnpm");
  });

  it("applies the fix (optionally committing) and reloads", async () => {
    const onReload = vi.fn(async () => {});
    render(<IssueActions issue={issue} fileId="/f" index={0} aiReady={false} entitled onReload={onReload} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /Commit to a git branch/ }));
    fireEvent.click(screen.getByRole("button", { name: /Apply fix/ }));
    await waitFor(() => expect(applyFix).toHaveBeenCalledWith("/f", [{ from: "npm", to: "pnpm" }], true, "manual"));
    await waitFor(() => expect(onReload).toHaveBeenCalled());
    expect(await screen.findByRole("button", { name: /Undo/ })).toBeInTheDocument();
  });

  it("offers Undo when a backup exists, and reverts", async () => {
    hasBackup.mockResolvedValue({ status: "ok", data: true });
    render(<IssueActions issue={issue} fileId="/f" index={0} aiReady={false} entitled onReload={vi.fn(async () => {})} />);
    fireEvent.click(await screen.findByRole("button", { name: /Undo/ }));
    await waitFor(() => expect(undoFix).toHaveBeenCalledWith("/f"));
  });

  it("offers an AI rewrite only when a provider is set up", () => {
    const { rerender } = render(
      <IssueActions issue={issue} fileId="/f" index={0} aiReady={false} entitled onReload={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: /Suggest fix with AI/ })).toBeNull();
    rerender(<IssueActions issue={issue} fileId="/f" index={0} aiReady entitled onReload={vi.fn()} />);
    expect(screen.getByRole("button", { name: /Suggest fix with AI/ })).toBeInTheDocument();
  });
});
