import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import { pickFilter } from "@/test/filters";
import type { ProjectRow } from "@/lib/ipc";
import { Projects } from "./Projects";

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
const getProjectUsage = vi.hoisted(() => vi.fn());
const listFiles = vi.hoisted(() => vi.fn());
const getSetup = vi.hoisted(() => vi.fn());
const getUsageOverview = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, isTauri: true, commands: { listProjects, getSetup, getUsageOverview, getProjectUsage, listFiles } };
});

const project = (o: Partial<ProjectRow> = {}): ProjectRow => ({
  id: "/code/app",
  name: "app",
  grade: "B",
  score: 80,
  file_count: 3,
  issue_count: 2,
  logo: null,
  modified: null,
  harness: "claude_code",
  session_count: 12,
  last_session_at: "2026-08-20T09:00:00.000Z",
  never_used_count: 1,
  error_count: 0,
  exists: true,
  ...o,
});

const populated: ProjectRow[] = [
  project({ id: "/code/web-app", name: "web-app", grade: "A", issue_count: 0 }),
  project({ id: "/code/scripts", name: "scripts", grade: "F", issue_count: 11 }),
  project({ id: "/code/gone", name: "gone", grade: "C", issue_count: 1, exists: false, harness: null }),
];

const artifact = (id: number, kind: string, name: string) => ({
  id, harness: "claude_code", layer: "global", kind, name, path: `/x/${name}`, plugin_name: null,
  description: null, bytes: 0, grade: null, score: null, file_id: null, usage: null, issue_count: null, worst_severity: null,
});

/** Two global skills; the web-app project has its own agent. */
const SETUP = {
  harnesses: [{ id: "claude_code", display_name: "Claude Code", detected: true }],
  global: [artifact(1, "skill", "adapt"), artifact(2, "skill", "polish")],
  projects: [{ path: "/code/web-app", harness: "claude_code", artifacts: [{ ...artifact(3, "agent", "reviewer"), layer: "project" }] }],
};

/** The name cell of every rendered body row, in order. */
function rowNames(): string[] {
  return within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((tr) => tr.querySelectorAll("td")[0]?.textContent ?? "");
}

const renderScreen = async (navigate = vi.fn()) => {
  const view = render(<Projects navigate={navigate} />);
  await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
  return { ...view, navigate };
};

describe("Projects", () => {
  beforeEach(() => {
    sessionStorage.clear();
    listeners.clear();
    listProjects.mockReset();
    getSetup.mockReset();
    getUsageOverview.mockReset();
    getProjectUsage.mockReset();
    listFiles.mockReset();
    listFiles.mockResolvedValue({ status: "ok", data: [] });
    getProjectUsage.mockResolvedValue({ status: "ok", data: { ranked: [], sessions_per_day: [] } });
    getSetup.mockResolvedValue({ status: "ok", data: SETUP });
    getUsageOverview.mockResolvedValue({ status: "ok", data: { sessions_per_project: [{ path: "/code/web-app", name: "web-app", sessions: 4 }] } });
    listProjects.mockResolvedValue({ status: "ok", data: populated });
  });

  afterEach(cleanup);

  it("renders a row per scanned project", async () => {
    await renderScreen();
    await waitFor(() => expect(rowNames()).toHaveLength(3));
    expect(rowNames()).toEqual(expect.arrayContaining(["web-app", "scripts", "gone"]));
  });

  it("narrows to projects with open issues, and drops the ones without", async () => {
    await renderScreen();
    await waitFor(() => expect(rowNames()).toHaveLength(3));

    pickFilter("Status", "Has issues");

    await waitFor(() => expect(rowNames()).not.toContain("web-app"));
    expect(rowNames()).toEqual(expect.arrayContaining(["scripts", "gone"]));
  });

  it("narrows to a single grade", async () => {
    await renderScreen();
    await waitFor(() => expect(rowNames()).toHaveLength(3));

    // The option's accessible name is its letter followed by the faceted count.
    pickFilter("Grade", "A");

    await waitFor(() => expect(rowNames()).toEqual(["web-app"]));
  });

  it("narrows to projects whose folder is missing", async () => {
    await renderScreen();
    await waitFor(() => expect(rowNames()).toHaveLength(3));

    pickFilter("Status", "Missing folder");

    await waitFor(() => expect(rowNames()).toEqual(["gone"]));
  });

  it("opens Setup with the project's lens on a row click", async () => {
    const { navigate } = await renderScreen();
    await waitFor(() => expect(rowNames()).toHaveLength(3));

    fireEvent.click(screen.getByRole("row", { name: "web-app" }));

    expect(navigate).toHaveBeenCalledWith("setup", "lens=%2Fcode%2Fweb-app");
  });

  it("opens Setup with the project's lens when the data is overridden", () => {
    const navigate = vi.fn();
    render(<Projects navigate={navigate} data={populated} setup={null} sessions90={null} />);
    fireEvent.click(screen.getAllByRole("row")[1]);
    expect(navigate).toHaveBeenCalledWith("setup", expect.stringMatching(/^lens=/));
  });

  it("sorts by last session, newest first", () => {
    const rows = [
      project({ id: "/a", name: "old", last_session_at: "2026-01-01T00:00:00.000Z" }),
      project({ id: "/b", name: "new", last_session_at: "2026-09-01T00:00:00.000Z" }),
    ];
    render(<Projects navigate={vi.fn()} data={rows} setup={null} sessions90={null} />);
    expect(screen.getAllByRole("row")[1]).toHaveTextContent("new");
  });

  it("shows the numbers the project's lens would show, and the window's sessions", async () => {
    // Used in web-app: adapt (erroring). Never used there: polish and reviewer.
    getProjectUsage.mockImplementation(async (_h: string, path: string) => ({
      status: "ok",
      data: {
        sessions_per_day: [],
        ranked:
          path === "/code/web-app"
            ? [{ kind: "skill", target: "adapt", artifact_id: 1, uses: 5, sessions: 2, error_rate: 0.5, avg_turn_tokens: 1, last_used: null }]
            : [],
      },
    }));
    await renderScreen();
    await waitFor(() => {
      const cells = [...screen.getByRole("row", { name: "web-app" }).querySelectorAll("td")].map((td) => td.textContent);
      expect(cells.slice(3)).toEqual(expect.arrayContaining(["3", "4", "2", "1"]));
      expect([cells[3], cells[4], cells[6], cells[7]]).toEqual(["3", "4", "2", "1"]);
    });
    expect(getProjectUsage).toHaveBeenCalledWith("claude_code", "/code/web-app", 90);
  });

  it("still renders the table, with dashes, when the setup query fails", async () => {
    getSetup.mockRejectedValue(new Error("boom"));
    await renderScreen();
    await waitFor(() => expect(rowNames()).toHaveLength(3));
    const cells = [...screen.getByRole("row", { name: "web-app" }).querySelectorAll("td")].map((td) => td.textContent);
    expect([cells[3], cells[6], cells[7]]).toEqual(["—", "—", "—"]);
    expect(cells[4]).toBe("4");
  });

  it("refetches when a scan finishes", async () => {
    await renderScreen();
    await waitFor(() => expect(rowNames()).toHaveLength(3));

    listProjects.mockResolvedValue({
      status: "ok",
      data: [...populated, project({ id: "/code/new", name: "new" })],
    });
    await emit("scan-done");

    await waitFor(() => expect(rowNames()).toHaveLength(4));
  });

  it("refetches when the project set changes outside a scan", async () => {
    await renderScreen();
    await waitFor(() => expect(rowNames()).toHaveLength(3));

    // Removing a scan folder drops its projects before any rescan runs.
    listProjects.mockResolvedValue({ status: "ok", data: populated.slice(0, 1) });
    await emit("projects-changed");

    await waitFor(() => expect(rowNames()).toHaveLength(1));
  });

  it("says so when nothing has been scanned yet", async () => {
    listProjects.mockResolvedValue({ status: "ok", data: [] });
    await renderScreen();
    await waitFor(() => expect(screen.getByText(/No projects yet/)).toBeInTheDocument());
  });

  it("says the query failed rather than claiming nothing is scanned", async () => {
    listProjects.mockRejectedValue(new Error("database is locked"));
    render(<Projects navigate={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByText(/The project list query failed/)).toBeInTheDocument(),
    );
    // The one thing this state must never do is read as "you have no projects".
    expect(screen.queryByText(/No projects yet/)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("retries the query from the failure panel", async () => {
    listProjects.mockRejectedValue(new Error("database is locked"));
    render(<Projects navigate={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/The project list query failed/)).toBeInTheDocument(),
    );

    listProjects.mockResolvedValue({ status: "ok", data: populated });
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));

    await waitFor(() => expect(rowNames()).toHaveLength(3));
    expect(listProjects).toHaveBeenCalledTimes(2);
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderScreen();
    await waitFor(() => expect(rowNames()).toHaveLength(3));
    expect(await axe(container)).toHaveNoViolations();
  });
});
