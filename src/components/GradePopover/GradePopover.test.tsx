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
    const onFix = vi.fn(async () => ({ files: 2, edits: 5 }));
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
});
