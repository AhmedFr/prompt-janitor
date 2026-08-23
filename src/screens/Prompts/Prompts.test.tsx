import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { FileRow } from "@/lib/ipc";
import { Prompts } from "./Prompts";

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

const listFiles = vi.hoisted(() => vi.fn());
const scanNow = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return {
    ...actual,
    isTauri: true,
    commands: {
      listFiles,
      scanNow,
      // `useTemplatePicker` loads the catalog on mount; keep it off the bridge.
      listTemplates: vi.fn().mockResolvedValue([]),
      getEntitlement: vi.fn().mockResolvedValue({ status: "ok", data: { paid: false, email: null, plan: null } }),
    },
  };
});

const file = (o: Partial<FileRow> = {}): FileRow => ({
  id: "/code/api/CLAUDE.md",
  name: "CLAUDE.md",
  path: "/code/api/CLAUDE.md",
  project: "api",
  project_id: "/code/api",
  kind: "CLAUDE.md",
  grade: "B",
  score: 80,
  issue_count: 2,
  modified: "1750000000",
  ...o,
});

const populated: FileRow[] = [
  file({
    id: "/code/web/CLAUDE.md",
    path: "/code/web/CLAUDE.md",
    project: "web",
    project_id: "/code/web",
    grade: "A",
    issue_count: 0,
  }),
  file({
    id: "/code/web/docs/CLAUDE.md",
    path: "/code/web/docs/CLAUDE.md",
    project: "web",
    project_id: "/code/web",
    grade: "A",
    issue_count: 0,
  }),
  file({
    id: "/code/api/AGENTS.md",
    name: "AGENTS.md",
    path: "/code/api/AGENTS.md",
    kind: "AGENTS.md",
    grade: "F",
    issue_count: 4,
  }),
];

/** The id (= absolute path) of every rendered body row, in order. */
function rowIds(): string[] {
  return [...screen.getByRole("table").querySelectorAll("tbody tr[data-row-id]")].map(
    (tr) => (tr as HTMLElement).dataset.rowId ?? "",
  );
}

const renderScreen = async (props: Partial<React.ComponentProps<typeof Prompts>> = {}) => {
  const navigate = props.navigate ?? vi.fn();
  const view = render(<Prompts navigate={navigate} {...props} />);
  await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
  return { ...view, navigate };
};

describe("Prompts", () => {
  beforeEach(() => {
    sessionStorage.clear();
    listeners.clear();
    listFiles.mockReset();
    scanNow.mockReset();
    listFiles.mockResolvedValue({ status: "ok", data: populated });
    scanNow.mockResolvedValue({ status: "ok", data: null });
  });

  afterEach(cleanup);

  it("lists every scanned file as one flat table, not grouped under projects", async () => {
    const { container } = await renderScreen();
    await waitFor(() => expect(rowIds()).toHaveLength(3));
    expect(rowIds()).toEqual(expect.arrayContaining(["/code/web/CLAUDE.md", "/code/api/AGENTS.md"]));
    expect(container.querySelector(".p-group")).toBeNull();
  });

  it("names each row by its path — three files called CLAUDE.md are told apart by nothing else", async () => {
    await renderScreen();
    await waitFor(() => expect(rowIds()).toHaveLength(3));
    expect(screen.getByRole("row", { name: "/code/web/docs/CLAUDE.md" })).toBeInTheDocument();
  });

  it("opens the file's detail page on a row click", async () => {
    const { navigate } = await renderScreen();
    await waitFor(() => expect(rowIds()).toHaveLength(3));

    fireEvent.click(screen.getByRole("row", { name: "/code/api/AGENTS.md" }));

    expect(navigate).toHaveBeenCalledWith("detail", "/code/api/AGENTS.md");
  });

  it("opens the project page from the project chip, without also opening the file", async () => {
    const { navigate } = await renderScreen();
    await waitFor(() => expect(rowIds()).toHaveLength(3));

    fireEvent.click(screen.getAllByRole("button", { name: /Open project api/ })[0]);

    expect(navigate).toHaveBeenCalledWith("project", "/code/api");
    expect(navigate).not.toHaveBeenCalledWith("detail", expect.anything());
    // The chip's click is the chip's alone — the row must not also fire.
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it("searches on the path, so a folder narrows the table", async () => {
    await renderScreen();
    await waitFor(() => expect(rowIds()).toHaveLength(3));

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "/docs/" } });

    await waitFor(() => expect(rowIds()).toEqual(["/code/web/docs/CLAUDE.md"]));
  });

  it("narrows to one kind", async () => {
    await renderScreen();
    await waitFor(() => expect(rowIds()).toHaveLength(3));

    fireEvent.click(screen.getByRole("button", { name: /^AGENTS\.md\s*\d+$/ }));

    await waitFor(() => expect(rowIds()).toEqual(["/code/api/AGENTS.md"]));
  });

  it("narrows to one grade", async () => {
    await renderScreen();
    await waitFor(() => expect(rowIds()).toHaveLength(3));

    fireEvent.click(screen.getByRole("button", { name: /^F\s*\d+$/ }));

    await waitFor(() => expect(rowIds()).toEqual(["/code/api/AGENTS.md"]));
  });

  it("narrows to one project", async () => {
    await renderScreen();
    await waitFor(() => expect(rowIds()).toHaveLength(3));

    fireEvent.click(screen.getByRole("button", { name: /^web\s*\d+$/ }));

    await waitFor(() =>
      expect(rowIds()).toEqual(["/code/web/CLAUDE.md", "/code/web/docs/CLAUDE.md"]),
    );
  });

  it("narrows to files with open issues, and drops the clean ones", async () => {
    await renderScreen();
    await waitFor(() => expect(rowIds()).toHaveLength(3));

    fireEvent.click(screen.getByRole("button", { name: /Has issues/ }));

    await waitFor(() => expect(rowIds()).toEqual(["/code/api/AGENTS.md"]));
  });

  it("preselects the deep-linked project, over whatever the table last remembered", async () => {
    window.sessionStorage.setItem(
      "pj.table.prompts",
      JSON.stringify({ search: "", pills: { project: ["/code/web"] }, sort: null }),
    );

    await renderScreen({ target: "/code/api" });

    await waitFor(() => expect(rowIds()).toEqual(["/code/api/AGENTS.md"]));
    expect(screen.getByRole("button", { name: /^api\s*\d+$/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("leaves the deep-linked project selected on the next unqualified visit", async () => {
    // `initialPills` is written through, not layered on: the link decides where
    // the table lands, and coming back to it lands where the link left it.
    const first = await renderScreen({ target: "/code/api" });
    await waitFor(() => expect(rowIds()).toEqual(["/code/api/AGENTS.md"]));
    first.unmount();

    await renderScreen();

    await waitFor(() => expect(rowIds()).toEqual(["/code/api/AGENTS.md"]));
  });

  it("ignores a deep link to a project this table does not list", async () => {
    await renderScreen({ target: "/code/ghost" });

    await waitFor(() => expect(rowIds()).toHaveLength(3));
    expect(screen.queryByRole("button", { pressed: true })).not.toBeInTheDocument();
    // And nothing was stored, so the next visit is not filtered to a project
    // that was never on screen.
    expect(window.sessionStorage.getItem("pj.table.prompts") ?? "").not.toContain("ghost");
  });

  it("leaves the remembered filters alone when no project was deep-linked", async () => {
    window.sessionStorage.setItem(
      "pj.table.prompts",
      JSON.stringify({ search: "", pills: { project: ["/code/web"] }, sort: null }),
    );

    await renderScreen();

    await waitFor(() =>
      expect(rowIds()).toEqual(["/code/web/CLAUDE.md", "/code/web/docs/CLAUDE.md"]),
    );
  });

  it("refetches when a scan finishes", async () => {
    await renderScreen();
    await waitFor(() => expect(rowIds()).toHaveLength(3));

    listFiles.mockResolvedValue({
      status: "ok",
      data: [...populated, file({ id: "/code/cli/CLAUDE.md", path: "/code/cli/CLAUDE.md" })],
    });
    await emit("scan-done");

    await waitFor(() => expect(rowIds()).toHaveLength(4));
  });

  it("runs a scan from the toolbar", async () => {
    await renderScreen();
    fireEvent.click(screen.getByRole("button", { name: /Scan now/ }));
    await waitFor(() => expect(scanNow).toHaveBeenCalled());
  });

  it("says nothing has been scanned yet rather than showing an empty grid", async () => {
    listFiles.mockResolvedValue({ status: "ok", data: [] });
    await renderScreen();
    await waitFor(() => expect(screen.getByText(/No prompt files scanned yet/)).toBeInTheDocument());
  });

  it("says the query failed rather than claiming nothing is scanned", async () => {
    listFiles.mockRejectedValue(new Error("database is locked"));
    render(<Prompts navigate={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/The file list query failed/)).toBeInTheDocument());
    expect(screen.queryByText(/No prompt files scanned yet/)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("retries the query from the failure panel", async () => {
    listFiles.mockRejectedValue(new Error("database is locked"));
    render(<Prompts navigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/The file list query failed/)).toBeInTheDocument());

    listFiles.mockResolvedValue({ status: "ok", data: populated });
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));

    await waitFor(() => expect(rowIds()).toHaveLength(3));
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderScreen();
    await waitFor(() => expect(rowIds()).toHaveLength(3));
    expect(await axe(container)).toHaveNoViolations();
  });
});
