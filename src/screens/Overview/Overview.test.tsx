import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Overview } from "./Overview";
import type { FileRow, Overview as OverviewData } from "@/lib/ipc";

// jsdom does not implement scrollIntoView.
Element.prototype.scrollIntoView = vi.fn();

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("@/lib/ipc", async (orig) => {
  const mod = await orig<typeof import("@/lib/ipc")>();
  return {
    ...mod,
    isTauri: true,
    commands: {
      ...mod.commands,
      getOverview: vi.fn(),
      listFiles: vi.fn(),
    },
  };
});

const mockOverviewData: OverviewData = {
  has_data: true,
  scan_folder: "/home/user/projects",
  overall_grade: "B",
  overall_score: 78,
  file_count: 15,
  project_count: 3,
  critical: 2,
  warnings: 5,
  nits: 8,
  worklist: [
    {
      file_id: "/api/CLAUDE.md",
      title: "Missing AI goals section",
      location: "api/CLAUDE.md:1",
      severity: "hi",
      source: "anthropic",
      line: 1,
      project: "api",
      modified: "1234567890",
    },
    {
      file_id: "/web/AGENTS.md",
      title: "Unclear agent purpose",
      location: "web/AGENTS.md:10",
      severity: "mid",
      source: "openai",
      line: 10,
      project: "web",
      modified: "1234567890",
    },
  ],
  trend: [60, 65, 70, 78],
  trend_delta: 18,
  last_scan: "1234567890",
};

const mockFiles: FileRow[] = [
  {
    id: "/api/CLAUDE.md",
    name: "CLAUDE.md",
    path: "/api/CLAUDE.md",
    project: "api",
    project_id: "/api",
    kind: "CLAUDE.md",
    grade: "A",
    score: 95,
    issue_count: 0,
    modified: "1234567890",
  },
  {
    id: "/web/AGENTS.md",
    name: "AGENTS.md",
    path: "/web/AGENTS.md",
    project: "web",
    project_id: "/web",
    kind: "AGENTS.md",
    grade: "B",
    score: 82,
    issue_count: 3,
    modified: "1234567890",
  },
  {
    id: "/docs/.cursorrules",
    name: ".cursorrules",
    path: "/docs/.cursorrules",
    project: "docs",
    project_id: "/docs",
    kind: ".cursorrules",
    grade: "C",
    score: 65,
    issue_count: 5,
    modified: "1234567890",
  },
  {
    id: "/scripts/prompt.md",
    name: "prompt.md",
    path: "/scripts/prompt.md",
    project: "scripts",
    project_id: "/scripts",
    kind: "prompt.md",
    grade: "D",
    score: 50,
    issue_count: 8,
    modified: "1234567890",
  },
  {
    id: "/old/rules.txt",
    name: "rules.txt",
    path: "/old/rules.txt",
    project: "old",
    project_id: "/old",
    kind: "rules.txt",
    grade: "F",
    score: 30,
    issue_count: 12,
    modified: "1234567890",
  },
];

vi.mock("./useOverview", async (orig) => {
  const mod = await orig<typeof import("./useOverview")>();
  return {
    ...mod,
    useOverview: () => ({
      data: mockOverviewData,
      files: mockFiles,
      loading: false,
      refetch: vi.fn(),
    }),
  };
});

vi.mock("@/components/VerdictHero", async (orig) => {
  const mod = await orig<typeof import("@/components/VerdictHero")>();
  return {
    ...mod,
    useVerdictHero: () => ({
      verdict: {
        fixPath: [],
        projectedGrade: "A",
        fixesToA: 3,
        autofixCount: 7,
        detStandards: 12,
        totalStandards: 18,
        entitled: true,
        aiReady: true,
        loading: false,
      },
      autoFixBusy: false,
      runAutoFix: vi.fn(),
    }),
  };
});

describe("Overview", () => {
  afterEach(cleanup);

  it("renders the overall grade hero with B grade", () => {
    const { getByText, container } = render(<Overview navigate={vi.fn()} />);
    expect(getByText("B")).toBeInTheDocument();
    expect(getByText(/15 files · 3 projects/)).toBeInTheDocument();
    expect(container.textContent).toMatch(/78.*\/100/);
  });

  it("renders heatmap with one square per file", () => {
    const { container } = render(<Overview navigate={vi.fn()} />);
    const squares = container.querySelectorAll(".heatmap__sq");
    expect(squares).toHaveLength(5);
  });

  it("calls navigate when clicking a heatmap square", () => {
    const navigate = vi.fn();
    const { container } = render(<Overview navigate={navigate} />);
    const squares = container.querySelectorAll(".heatmap__sq");
    (squares[0] as HTMLButtonElement).click();
    expect(navigate).toHaveBeenCalledWith("detail", "/api/CLAUDE.md");
  });

  it("renders auto-fix banner with count", () => {
    const { getByText } = render(<Overview navigate={vi.fn()} />);
    expect(getByText("7 issues can be fixed automatically")).toBeInTheDocument();
    expect(getByText("Auto-fix 7")).toBeInTheDocument();
  });

  it("calls navigate when clicking a Biggest wins row", () => {
    const navigate = vi.fn();
    const { getByText } = render(<Overview navigate={navigate} />);
    // Find the row for the first worklist item
    const row = getByText("Missing AI goals section").closest("button");
    row?.click();
    expect(navigate).toHaveBeenCalledWith("detail", "/api/CLAUDE.md");
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Overview navigate={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
