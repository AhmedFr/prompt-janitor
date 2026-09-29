import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("./useGradePopover", () => ({ useGradePopover: () => { throw new Error("state override expected"); } }));
import { GradePopover } from "./GradePopover";

afterEach(cleanup);

describe("GradePopover", () => {
  it("opens on click with the trend, the open findings and Fix N automatically", () => {
    render(<GradePopover grade="C" state={{ trend: [{ t: "1790000000", score: 70 }, { t: "1790086400", score: 74 }], openFindings: 12, fixable: 5, loading: false }} />);
    fireEvent.click(screen.getByRole("button", { name: "Grade C, show health trend" }));
    expect(screen.getByRole("dialog", { name: "Health trend" })).toBeInTheDocument();
    expect(screen.getByText("12 open findings")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fix 5 issues automatically" })).toBeInTheDocument();
  });

  it("closes on Escape and hides the fix button when nothing is fixable", () => {
    render(<GradePopover grade="A" state={{ trend: [], openFindings: 0, fixable: 0, loading: false }} />);
    fireEvent.click(screen.getByRole("button", { name: /Grade A/ }));
    expect(screen.queryByRole("button", { name: /automatically/ })).toBeNull();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("runs Fix N automatically and says what it fixed", async () => {
    const onFix = vi.fn(async () => ({ files: 2, edits: 5, failed: 0 }));
    render(<GradePopover grade="C" state={{ trend: [], openFindings: 12, fixable: 5, loading: false }} onFix={onFix} />);
    fireEvent.click(screen.getByRole("button", { name: /Grade C/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fix 5 issues automatically" }));
    expect(onFix).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("Fixed 5 issues in 2 files");
  });

  it("renders nothing before the first scan", () => {
    const { container } = render(<GradePopover grade={null} state={{ trend: [], openFindings: 0, fixable: 0, loading: false }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a rejected fix instead of swallowing it", async () => {
    const onFix = vi.fn(async () => { throw new Error("disk full"); });
    render(<GradePopover grade="C" state={{ trend: [], openFindings: 12, fixable: 5, loading: false }} onFix={onFix} />);
    fireEvent.click(screen.getByRole("button", { name: /Grade C/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fix 5 issues automatically" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't fix: disk full");
  });

  it("says Couldn't fix when every file failed, never Nothing to fix", async () => {
    const onFix = vi.fn(async () => ({ files: 0, edits: 0, failed: 2, firstError: "read-only" }));
    render(<GradePopover grade="C" state={{ trend: [], openFindings: 12, fixable: 5, loading: false }} onFix={onFix} />);
    fireEvent.click(screen.getByRole("button", { name: /Grade C/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fix 5 issues automatically" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't fix 2 files: read-only");
    expect(screen.queryByText("Nothing to fix")).toBeNull();
  });

  it("reports a partial failure with what was fixed", async () => {
    const onFix = vi.fn(async () => ({ files: 1, edits: 2, failed: 1, firstError: "read-only" }));
    render(<GradePopover grade="C" state={{ trend: [], openFindings: 12, fixable: 5, loading: false }} onFix={onFix} />);
    fireEvent.click(screen.getByRole("button", { name: /Grade C/ }));
    fireEvent.click(screen.getByRole("button", { name: "Fix 5 issues automatically" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't fix 1 file: read-only. Fixed 2 issues in 1 file.");
  });

  it("shows a load failure instead of zeros", () => {
    render(<GradePopover grade="C" state={{ trend: [], openFindings: 0, fixable: 0, loading: false, error: true }} />);
    fireEvent.click(screen.getByRole("button", { name: /Grade C/ }));
    expect(screen.getByText("Couldn't load the trend.")).toBeInTheDocument();
    expect(screen.queryByText(/open finding/)).toBeNull();
  });
});
