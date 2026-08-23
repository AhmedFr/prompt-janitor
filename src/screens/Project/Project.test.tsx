import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import type {
  ArtifactView,
  EffectiveRule,
  FileRow,
  ProjectRow,
  ProjectSetup,
  ProjectUsage,
  RankedTarget,
  SetupView,
} from "@/lib/ipc";
import { Project } from "./Project";

// One handler registry per test so a case can emit `scan-done` like the core does.
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
const getSetup = vi.hoisted(() => vi.fn());
const getEffectiveRules = vi.hoisted(() => vi.fn());
const getProjectUsage = vi.hoisted(() => vi.fn());
const scanNow = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return {
    ...actual,
    isTauri: true,
    commands: { listProjects, listFiles, getSetup, getEffectiveRules, getProjectUsage, scanNow },
  };
});

const PATH = "/code/web-app";

/** Fixture timestamps are anchored to the run's own clock so relative copy is exact. */
const agoIso = (ms: number) => new Date(Date.now() - ms).toISOString();
const HOUR = 3_600_000;

const project = (o: Partial<ProjectRow> = {}): ProjectRow => ({
  id: PATH,
  name: "web-app",
  grade: "A",
  score: 94,
  file_count: 2,
  issue_count: 4,
  logo: null,
  modified: null,
  harness: "claude_code",
  session_count: 41,
  last_session_at: agoIso(3 * HOUR),
  never_used_count: 1,
  error_count: 0,
  exists: true,
  ...o,
});

const file = (o: Partial<FileRow> = {}): FileRow => ({
  id: `${PATH}/CLAUDE.md`,
  name: "CLAUDE.md",
  path: `${PATH}/CLAUDE.md`,
  project: "web-app",
  project_id: PATH,
  kind: "CLAUDE.md",
  grade: "B",
  score: 80,
  issue_count: 3,
  modified: "1700000000",
  ...o,
});

const artifact = (o: Partial<ArtifactView> = {}): ArtifactView => ({
  id: 1,
  harness: "claude_code",
  layer: "project",
  kind: "skill",
  name: "pdf-extract",
  path: `${PATH}/.claude/skills/pdf-extract/SKILL.md`,
  plugin_name: null,
  description: null,
  bytes: 2048,
  grade: null,
  score: null,
  file_id: null,
  usage: null,
  ...o,
});

const rule = (o: Partial<EffectiveRule> = {}): EffectiveRule => ({
  layer: "project",
  path: `${PATH}/CLAUDE.md`,
  name: "CLAUDE.md",
  grade: "B",
  file_id: `${PATH}/CLAUDE.md`,
  ...o,
});

const target = (o: Partial<RankedTarget> = {}): RankedTarget => ({
  kind: "skill",
  target: "pdf-extract",
  artifact_id: null,
  uses: 12,
  sessions: 3,
  error_rate: null,
  avg_turn_tokens: null,
  ...o,
});

const projectSetup = (o: Partial<ProjectSetup> = {}): ProjectSetup => ({
  harness: "claude_code",
  path: PATH,
  name: "web-app",
  exists: true,
  session_count: 41,
  last_session_at: agoIso(3 * HOUR),
  artifacts: [
    artifact({ id: 1, kind: "rule", name: "CLAUDE.md", file_id: `${PATH}/CLAUDE.md` }),
    artifact({ id: 2, kind: "skill", name: "pdf-extract" }),
    artifact({ id: 3, kind: "settings", name: "settings.json" }),
  ],
  ...o,
});

const setupView = (o: Partial<SetupView> = {}): SetupView => ({
  harnesses: [
    {
      id: "claude_code",
      display_name: "Claude Code",
      detected: true,
      last_scan_at: agoIso(27 * HOUR),
      project_count: 2,
      session_count: 80,
    },
  ],
  global: [],
  projects: [projectSetup()],
  ...o,
});

const usage = (o: Partial<ProjectUsage> = {}): ProjectUsage => ({
  ranked: [
    target({ kind: "skill", target: "pdf-extract", uses: 12, sessions: 3 }),
    target({ kind: "agent", target: "code-reviewer", uses: 5, sessions: 2 }),
  ],
  sessions_per_day: [
    { day: "2026-08-19", count: 2 },
    { day: "2026-08-20", count: 0 },
    { day: "2026-08-21", count: 5 },
  ],
  ...o,
});

const FILES = [
  file(),
  file({ id: `${PATH}/AGENTS.md`, name: "AGENTS.md", path: `${PATH}/AGENTS.md`, grade: "D", issue_count: 9 }),
  file({ id: "/code/other/CLAUDE.md", project_id: "/code/other", project: "other", name: "other.md" }),
];

const EFFECTIVE = [
  rule({ layer: "project", name: "CLAUDE.md", grade: "B" }),
  rule({ layer: "global", name: "global-rules.md", path: "/Users/dev/.claude/CLAUDE.md", grade: null, file_id: null }),
];

/** Renders the screen and waits for the first paint of real data. */
async function renderScreen(props: { path?: string; navigate?: ReturnType<typeof vi.fn> } = {}) {
  const navigate = props.navigate ?? vi.fn();
  const view = render(<Project path={"path" in props ? props.path : PATH} navigate={navigate} />);
  return { ...view, navigate };
}

const openTab = (name: string) => fireEvent.click(screen.getByRole("tab", { name: new RegExp(name) }));

/** The name cell of every rendered body row, in order. */
function rowNames(): string[] {
  return within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((tr) => tr.querySelectorAll("td")[0]?.textContent ?? "");
}

describe("Project", () => {
  beforeEach(() => {
    sessionStorage.clear();
    listeners.clear();
    listProjects.mockReset().mockResolvedValue({ status: "ok", data: [project()] });
    listFiles.mockReset().mockResolvedValue({ status: "ok", data: FILES });
    getSetup.mockReset().mockResolvedValue({ status: "ok", data: setupView() });
    getEffectiveRules.mockReset().mockResolvedValue({ status: "ok", data: EFFECTIVE });
    getProjectUsage.mockReset().mockResolvedValue({ status: "ok", data: usage() });
    scanNow.mockReset().mockResolvedValue({ status: "ok", data: {} });
  });

  afterEach(cleanup);

  describe("header", () => {
    it("titles the page with the project's name", async () => {
      await renderScreen();
      await waitFor(() =>
        expect(screen.getByRole("heading", { level: 1, name: "web-app" })).toBeInTheDocument(),
      );
    });

    it("shows the project's path in full", async () => {
      await renderScreen();
      await waitFor(() => expect(screen.getByTitle(PATH)).toBeInTheDocument());
    });

    it("shows the grade ring with the project's score", async () => {
      await renderScreen();
      await waitFor(() => expect(screen.getByText("94/100")).toBeInTheDocument());
    });

    it("counts the sessions worked here and when the last one was", async () => {
      await renderScreen();
      await waitFor(() => expect(screen.getByText("Sessions")).toBeInTheDocument());
      expect(screen.getByText("41")).toBeInTheDocument();
      expect(screen.getByText("3h ago")).toBeInTheDocument();
    });

    it("says when the harness that works here was last scanned", async () => {
      await renderScreen();
      await waitFor(() => expect(screen.getByText("Last scan")).toBeInTheDocument());
      expect(screen.getByText("1d ago")).toBeInTheDocument();
    });

    it("rescans everything from the header button", async () => {
      await renderScreen();
      await waitFor(() => expect(screen.getByRole("button", { name: /Rescan/ })).toBeEnabled());

      fireEvent.click(screen.getByRole("button", { name: /Rescan/ }));

      await waitFor(() => expect(scanNow).toHaveBeenCalledTimes(1));
    });

    it("says the folder is gone when the disk has lost it", async () => {
      listProjects.mockResolvedValue({ status: "ok", data: [project({ exists: false })] });
      await renderScreen();
      await waitFor(() =>
        expect(screen.getByText(/Folder missing from disk/)).toBeInTheDocument(),
      );
    });

    it("announces the missing folder rather than leaving it to be noticed", async () => {
      // The banner appears after the page has already painted — a reader on a
      // screen reader is past it by then unless it is a live region.
      listProjects.mockResolvedValue({ status: "ok", data: [project({ exists: false })] });
      await renderScreen();
      await waitFor(() =>
        expect(screen.getByRole("status")).toHaveTextContent(/Folder missing from disk/),
      );
    });

    it("says nothing about a missing folder when the folder is there", async () => {
      await renderScreen();
      await waitFor(() => expect(screen.getByRole("tablist")).toBeInTheDocument());
      expect(screen.queryByText(/Folder missing from disk/)).not.toBeInTheDocument();
    });

    it("goes back to the projects table", async () => {
      const { navigate } = await renderScreen();
      await waitFor(() => expect(screen.getByRole("tablist")).toBeInTheDocument());

      fireEvent.click(screen.getByRole("button", { name: "Back to Projects" }));

      expect(navigate).toHaveBeenCalledWith("projects");
    });
  });

  describe("Rules tab", () => {
    it("lists only this project's scanned files", async () => {
      await renderScreen();
      await waitFor(() => expect(rowNames()).toHaveLength(2));
      expect(rowNames()).toEqual(expect.arrayContaining(["CLAUDE.md", "AGENTS.md"]));
      expect(rowNames()).not.toContain("other.md");
    });

    it("opens the file's detail page on a row click", async () => {
      const { navigate } = await renderScreen();
      await waitFor(() => expect(rowNames()).toHaveLength(2));

      fireEvent.click(screen.getByRole("row", { name: "AGENTS.md" }));

      expect(navigate).toHaveBeenCalledWith("detail", `${PATH}/AGENTS.md`);
    });

    it("says so when nothing was scanned inside the project", async () => {
      listFiles.mockResolvedValue({ status: "ok", data: [] });
      await renderScreen();
      await waitFor(() =>
        expect(screen.getByText(/No prompt files scanned here/)).toBeInTheDocument(),
      );
    });
  });

  describe("Effective rules tab", () => {
    it("lists the load-order stack, global layer first", async () => {
      await renderScreen();
      await waitFor(() => expect(screen.getByRole("tablist")).toBeInTheDocument());
      openTab("Effective rules");

      const items = await screen.findAllByRole("listitem");
      expect(items.map((li) => li.textContent)).toEqual([
        expect.stringContaining("global-rules.md"),
        expect.stringContaining("CLAUDE.md"),
      ]);
    });

    it("grades the files it can, and marks the ones it cannot", async () => {
      await renderScreen();
      await waitFor(() => expect(screen.getByRole("tablist")).toBeInTheDocument());
      openTab("Effective rules");

      expect(await screen.findByLabelText("Grade B")).toBeInTheDocument();
      expect(screen.getByLabelText("Ungraded")).toBeInTheDocument();
    });

    it("shows each rule's path in full", async () => {
      await renderScreen();
      await waitFor(() => expect(screen.getByRole("tablist")).toBeInTheDocument());
      openTab("Effective rules");

      expect(await screen.findByTitle("/Users/dev/.claude/CLAUDE.md")).toBeInTheDocument();
    });

    it("says so when no rule file applies here", async () => {
      getEffectiveRules.mockResolvedValue({ status: "ok", data: [] });
      await renderScreen();
      await waitFor(() => expect(screen.getByRole("tablist")).toBeInTheDocument());
      openTab("Effective rules");

      expect(await screen.findByText(/No rule files load in this project/)).toBeInTheDocument();
    });
  });

  describe("Setup tab", () => {
    it("puts every kind configured here in one table", async () => {
      await renderScreen();
      await waitFor(() => expect(screen.getByRole("tablist")).toBeInTheDocument());
      openTab("Setup");

      await waitFor(() => expect(rowNames()).toHaveLength(3));
      expect(rowNames()).toEqual(["Rule", "Skill", "Settings"]);
      expect(screen.getByText("pdf-extract")).toBeInTheDocument();
      expect(screen.getByText("settings.json")).toBeInTheDocument();
    });

    it("says so when nothing is configured in the project", async () => {
      getSetup.mockResolvedValue({
        status: "ok",
        data: setupView({ projects: [projectSetup({ artifacts: [] })] }),
      });
      await renderScreen();
      await waitFor(() => expect(screen.getByRole("tablist")).toBeInTheDocument());
      openTab("Setup");

      expect(await screen.findByText(/Nothing configured in this project/)).toBeInTheDocument();
    });
  });

  describe("Usage tab", () => {
    it("ranks the skills invoked here, with the sessions behind them", async () => {
      await renderScreen();
      await waitFor(() => expect(screen.getByRole("tablist")).toBeInTheDocument());
      openTab("Usage");

      expect(await screen.findByText("pdf-extract")).toBeInTheDocument();
      expect(screen.getByText("3 sessions")).toBeInTheDocument();
    });

    it("switches the ranking to another invocation kind", async () => {
      await renderScreen();
      await waitFor(() => expect(screen.getByRole("tablist")).toBeInTheDocument());
      openTab("Usage");

      fireEvent.click(await screen.findByRole("button", { name: "Agents" }));

      expect(await screen.findByText("code-reviewer")).toBeInTheDocument();
      expect(screen.queryByText("pdf-extract")).not.toBeInTheDocument();
    });

    it("charts the sessions worked here per day", async () => {
      await renderScreen();
      await waitFor(() => expect(screen.getByRole("tablist")).toBeInTheDocument());
      openTab("Usage");

      expect(await screen.findByRole("img", { name: "Sessions per day" })).toBeInTheDocument();
    });

    it("asks for the trailing 90 days", async () => {
      await renderScreen();
      await waitFor(() => expect(getProjectUsage).toHaveBeenCalled());
      expect(getProjectUsage).toHaveBeenCalledWith("claude_code", PATH, 90);
    });

    it("says so when nothing was invoked here", async () => {
      getProjectUsage.mockResolvedValue({
        status: "ok",
        data: usage({ ranked: [], sessions_per_day: [] }),
      });
      await renderScreen();
      await waitFor(() => expect(screen.getByRole("tablist")).toBeInTheDocument());
      openTab("Usage");

      expect(await screen.findByText(/Nothing was invoked here/)).toBeInTheDocument();
    });
  });

  describe("without a harness", () => {
    beforeEach(() => {
      listProjects.mockResolvedValue({ status: "ok", data: [project({ harness: null })] });
    });

    it("asks for neither the load order nor the usage", async () => {
      await renderScreen();
      await waitFor(() => expect(screen.getByRole("tablist")).toBeInTheDocument());
      expect(getEffectiveRules).not.toHaveBeenCalled();
      expect(getProjectUsage).not.toHaveBeenCalled();
    });

    it("says why the load order is unknown", async () => {
      await renderScreen();
      await waitFor(() => expect(screen.getByRole("tablist")).toBeInTheDocument());
      openTab("Effective rules");
      expect(await screen.findByText(/No agent harness has worked in this project/)).toBeInTheDocument();
    });

    it("says why there is no usage", async () => {
      await renderScreen();
      await waitFor(() => expect(screen.getByRole("tablist")).toBeInTheDocument());
      openTab("Usage");
      expect(await screen.findByText(/No agent harness has worked in this project/)).toBeInTheDocument();
    });

    it("still lists the project's files and setup", async () => {
      await renderScreen();
      await waitFor(() => expect(rowNames()).toHaveLength(2));
    });
  });

  describe("states", () => {
    it("says nothing is selected rather than guessing at a project", async () => {
      const navigate = vi.fn();
      render(<Project path={undefined} navigate={navigate} />);

      expect(screen.getByText(/No project selected/)).toBeInTheDocument();
      expect(listProjects).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Back to Projects" }));
      expect(navigate).toHaveBeenCalledWith("projects");
    });

    it("says the query failed rather than claiming the project is empty", async () => {
      listProjects.mockRejectedValue(new Error("database is locked"));
      await renderScreen();

      await waitFor(() =>
        expect(screen.getByText(/The project query failed/)).toBeInTheDocument(),
      );
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.queryByText(/No prompt files scanned here/)).not.toBeInTheDocument();
    });

    it("retries the query from the failure panel", async () => {
      listProjects.mockRejectedValue(new Error("database is locked"));
      await renderScreen();
      await waitFor(() => expect(screen.getByText(/The project query failed/)).toBeInTheDocument());

      listProjects.mockResolvedValue({ status: "ok", data: [project()] });
      fireEvent.click(screen.getByRole("button", { name: /Try again/ }));

      await waitFor(() => expect(rowNames()).toHaveLength(2));
    });

    it("says the project is not in the scan rather than showing a blank page", async () => {
      listProjects.mockResolvedValue({ status: "ok", data: [] });
      await renderScreen();

      await waitFor(() => expect(screen.getByText(/Project not found/)).toBeInTheDocument());
      expect(screen.queryByText(/The project query failed/)).not.toBeInTheDocument();
    });

    it("fails the page when the file list fails, rather than emptying the table", async () => {
      // One query answering and another not is not "this project has no
      // files" — it is a read the page cannot honestly render.
      listFiles.mockResolvedValue({ status: "error", error: "database is locked" });
      await renderScreen();

      await waitFor(() => expect(screen.getByText(/The project query failed/)).toBeInTheDocument());
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.queryByText(/No prompt files scanned here/)).not.toBeInTheDocument();
    });

    it("fails the page when the setup query fails, rather than emptying the inventory", async () => {
      getSetup.mockResolvedValue({ status: "error", error: "database is locked" });
      await renderScreen();

      await waitFor(() => expect(screen.getByText(/The project query failed/)).toBeInTheDocument());
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
      expect(screen.queryByText(/Nothing configured in this project/)).not.toBeInTheDocument();
    });

    it("keeps the page when only the harness-scoped reads fail", async () => {
      // Those two are scoped to a harness and are allowed to come back empty;
      // failing them must not take the whole project down with them.
      getEffectiveRules.mockResolvedValue({ status: "error", error: "no such harness" });
      getProjectUsage.mockResolvedValue({ status: "error", error: "no such harness" });
      await renderScreen();

      await waitFor(() => expect(rowNames()).toHaveLength(2));
      expect(screen.queryByText(/The project query failed/)).not.toBeInTheDocument();
    });

    it("refetches everything when a scan finishes", async () => {
      await renderScreen();
      await waitFor(() => expect(rowNames()).toHaveLength(2));

      listFiles.mockResolvedValue({
        status: "ok",
        data: [...FILES, file({ id: `${PATH}/new.md`, name: "new.md", path: `${PATH}/new.md` })],
      });
      await emit("scan-done");

      await waitFor(() => expect(rowNames()).toHaveLength(3));
    });

    it("ignores a fetch that lands after the reader moved to another project", async () => {
      const ALPHA = "/code/alpha";
      const BETA = "/code/beta";
      const rows = [
        project({ id: ALPHA, name: "alpha", score: 11 }),
        project({ id: BETA, name: "beta", score: 22 }),
      ];
      // The first project's read hangs; the second answers immediately.
      let release!: () => void;
      listProjects.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ status: "ok", data: rows });
          }),
      );
      listProjects.mockImplementation(async () => ({ status: "ok", data: rows }));
      const navigate = vi.fn();

      const { rerender } = render(<Project path={ALPHA} navigate={navigate} />);
      rerender(<Project path={BETA} navigate={navigate} />);
      await waitFor(() =>
        expect(screen.getByRole("heading", { level: 1, name: "beta" })).toBeInTheDocument(),
      );

      await act(async () => {
        release();
      });

      // The late answer is about a project the reader has already left.
      expect(screen.getByRole("heading", { level: 1, name: "beta" })).toBeInTheDocument();
      expect(screen.queryByText("alpha")).not.toBeInTheDocument();
    });

    it("never flashes the failure panel when a superseded fetch fails", async () => {
      const ALPHA = "/code/alpha";
      const BETA = "/code/beta";
      let reject!: () => void;
      listProjects.mockImplementationOnce(
        () =>
          new Promise((_, r) => {
            reject = () => r(new Error("database is locked"));
          }),
      );
      listProjects.mockImplementation(async () => ({
        status: "ok",
        data: [project({ id: BETA, name: "beta" })],
      }));
      const navigate = vi.fn();

      const { rerender } = render(<Project path={ALPHA} navigate={navigate} />);
      rerender(<Project path={BETA} navigate={navigate} />);
      await waitFor(() =>
        expect(screen.getByRole("heading", { level: 1, name: "beta" })).toBeInTheDocument(),
      );

      await act(async () => {
        reject();
      });

      expect(screen.queryByText(/The project query failed/)).not.toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1, name: "beta" })).toBeInTheDocument();
    });

    it("stops listening for scans once it is gone", async () => {
      const { unmount } = await renderScreen();
      await waitFor(() => expect(rowNames()).toHaveLength(2));

      unmount();
      await waitFor(() => expect(listeners.has("scan-done")).toBe(false));
    });
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderScreen();
    await waitFor(() => expect(rowNames()).toHaveLength(2));
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations with nothing selected", async () => {
    const { container } = render(<Project path={undefined} navigate={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
