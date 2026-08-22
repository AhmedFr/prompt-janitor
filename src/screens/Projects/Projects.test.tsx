import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { axe } from "vitest-axe";
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

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, isTauri: true, commands: { listProjects } };
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
    listProjects.mockResolvedValue({ status: "ok", data: populated });
  });

  afterEach(cleanup);

  it("renders a row per scanned project", async () => {
    await renderScreen();
    await waitFor(() => expect(rowNames()).toHaveLength(3));
    expect(rowNames()).toEqual(expect.arrayContaining(["web-app", "scripts", "gone"]));
  });

  it("chips the project whose folder is gone", async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByText("folder missing")).toBeInTheDocument());
  });

  it("narrows to projects with open issues, and drops the ones without", async () => {
    await renderScreen();
    await waitFor(() => expect(rowNames()).toHaveLength(3));

    fireEvent.click(screen.getByRole("button", { name: /Has issues/ }));

    await waitFor(() => expect(rowNames()).not.toContain("web-app"));
    expect(rowNames()).toEqual(expect.arrayContaining(["scripts", "gone"]));
  });

  it("narrows to a single grade", async () => {
    await renderScreen();
    await waitFor(() => expect(rowNames()).toHaveLength(3));

    // The chip's accessible name is its letter followed by the faceted count.
    fireEvent.click(screen.getByRole("button", { name: /^A\s*\d+$/ }));

    await waitFor(() => expect(rowNames()).toEqual(["web-app"]));
  });

  it("narrows to projects whose folder is missing", async () => {
    await renderScreen();
    await waitFor(() => expect(rowNames()).toHaveLength(3));

    fireEvent.click(screen.getByRole("button", { name: /Missing folder/ }));

    await waitFor(() => expect(rowNames()).toEqual(["gone"]));
  });

  it("opens the project page on a row click, keyed by the project's path", async () => {
    const { navigate } = await renderScreen();
    await waitFor(() => expect(rowNames()).toHaveLength(3));

    fireEvent.click(screen.getByRole("row", { name: "web-app" }));

    expect(navigate).toHaveBeenCalledWith("project", "/code/web-app");
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

  it("says so when nothing has been scanned yet", async () => {
    listProjects.mockResolvedValue({ status: "ok", data: [] });
    await renderScreen();
    await waitFor(() => expect(screen.getByText(/No projects scanned yet/)).toBeInTheDocument());
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderScreen();
    await waitFor(() => expect(rowNames()).toHaveLength(3));
    expect(await axe(container)).toHaveNoViolations();
  });
});
