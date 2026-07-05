import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { Overview } from "@/lib/ipc";
import { VerdictHero } from "./VerdictHero";
import { verdictSentence } from "./VerdictHero.constants";
import type { VerdictData, VerdictHeroProps } from "./VerdictHero.types";

const openExternal = vi.hoisted(() => vi.fn());
vi.mock("@/lib/open-external", () => ({ openExternal }));

const overview: Overview = {
  has_data: true,
  scan_folder: "~/code",
  overall_grade: "C",
  overall_score: 71,
  file_count: 14,
  project_count: 6,
  critical: 3,
  warnings: 5,
  nits: 4,
  worklist: [],
  trend: [],
  trend_delta: 0,
  last_scan: null,
};

const verdict: VerdictData = {
  fixPath: [
    { fileId: "f1", fileName: "CLAUDE.md", title: "Deprecated model", severity: "hi", points: 15 },
  ],
  projectedGrade: "B",
  fixesToA: 6,
  autofixCount: 4,
  detStandards: 5,
  totalStandards: 30,
  entitled: false,
  aiReady: false,
  loading: false,
};

function renderHero(overrides: Partial<VerdictHeroProps> = {}) {
  const props: VerdictHeroProps = {
    data: overview,
    verdict,
    scanning: false,
    autoFixBusy: false,
    onScanNow: () => {},
    onAutoFix: () => {},
    navigate: () => {},
    ...overrides,
  };
  return render(<VerdictHero {...props} />);
}

beforeEach(() => {
  openExternal.mockClear();
});

afterEach(cleanup);

describe("verdictSentence", () => {
  it("keys the sentence off the grade", () => {
    expect(verdictSentence("A", 0)).toBe("Good enough. Your instruction files meet the bar.");
    expect(verdictSentence("C", 0)).toBe("Not yet. Your AI runs on C-grade instructions.");
    expect(verdictSentence("F", 0)).toBe(
      "Failing. Your AI is working against broken instructions.",
    );
  });

  it("fills in the computed fix count for a B, with pluralization", () => {
    expect(verdictSentence("B", 3)).toBe("Close — 3 fixes from an A.");
    expect(verdictSentence("B", 1)).toBe("Close — 1 fix from an A.");
  });
});

describe("VerdictHero", () => {
  it("shows the verdict sentence and the cost line when criticals exist", () => {
    renderHero();
    expect(screen.getByText("Not yet. Your AI runs on C-grade instructions.")).toBeInTheDocument();
    expect(
      screen.getByText("You pay for AI every month — 3 critical issues degrading what it gives back."),
    ).toBeInTheDocument();
  });

  it("hides the cost line when there are no critical issues", () => {
    renderHero({ data: { ...overview, critical: 0 } });
    expect(screen.queryByText(/You pay for AI every month/)).not.toBeInTheDocument();
  });

  it("renders the fix path with points and the projected grade", () => {
    renderHero();
    expect(screen.getByText("Deprecated model")).toBeInTheDocument();
    expect(screen.getByText("+15 pts")).toBeInTheDocument();
    expect(screen.getByText("Fix these 1 →")).toBeInTheDocument();
    expect(screen.getByLabelText("Grade B")).toBeInTheDocument();
  });

  it("navigates to the file's detail view when a fix-path row is clicked", () => {
    const navigate = vi.fn();
    renderHero({ navigate });
    fireEvent.click(screen.getByText("Deprecated model"));
    expect(navigate).toHaveBeenCalledWith("detail", "f1");
  });

  it("shows partial coverage with a Settings → AI link when no provider is set", () => {
    const navigate = vi.fn();
    renderHero({ navigate });
    expect(screen.getByText(/Graded on 5 of 30 standards/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("connect a model to grade all 30"));
    expect(navigate).toHaveBeenCalledWith("settings", "ai");
  });

  it("shows full coverage when a provider is configured", () => {
    renderHero({ verdict: { ...verdict, aiReady: true } });
    expect(screen.getByText("Grading against 30 standards.")).toBeInTheDocument();
  });

  it("opens the checkout instead of fixing when Auto-fix is locked", () => {
    const onAutoFix = vi.fn();
    renderHero({ onAutoFix });
    fireEvent.click(screen.getByRole("button", { name: /Auto-fix 4/ }));
    expect(openExternal).toHaveBeenCalledWith(expect.stringContaining("polar"));
    expect(onAutoFix).not.toHaveBeenCalled();
    // The paste-a-key escape hatch is offered next to the locked button.
    expect(screen.getByText("Settings → License")).toBeInTheDocument();
  });

  it("runs the auto-fix when entitled", () => {
    const onAutoFix = vi.fn();
    renderHero({ onAutoFix, verdict: { ...verdict, entitled: true } });
    fireEvent.click(screen.getByRole("button", { name: /Auto-fix 4/ }));
    expect(onAutoFix).toHaveBeenCalled();
    expect(openExternal).not.toHaveBeenCalled();
  });
});
