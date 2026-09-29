import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import { pickFilter } from "@/test/filters";
import { Setup } from "./Setup";
import type { FileRow } from "@/lib/ipc";
import { KIND_CHIP_ORDER, KIND_SINGULAR, LABEL } from "@/lib/vocabulary";
import { artifact, noHarness, populated, withOtherProject } from "./setup.fixtures";
import { NO_ITEMS_TITLE } from "./Setup.constants";
import type { ArtifactSourceState } from "./Setup.types";

const open = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));
// The viewer's reads and its Findings/Usage tabs are stubbed, so these cases
// exercise Setup's wiring only; `ItemViewer.test.tsx` mounts the real ones.
const loadedSource = vi.hoisted(
  () => (): ArtifactSourceState => ({
    content: "# Item",
    path: "/item.md",
    format: "markdown",
    editable: false,
    modified: "1",
    loading: false,
    saving: false,
    error: null,
    save: async () => null,
    reload: () => {},
  }),
);
vi.mock("./useArtifactSource", () => ({ useArtifactSource: loadedSource }));
vi.mock("./ItemViewer/useGradedSource", () => ({ useGradedSource: loadedSource }));
vi.mock("./Findings", () => ({ Findings: () => <div data-testid="findings" /> }));
// The stub keeps the Usage tab's one way out: a project link, which turns the lens on.
vi.mock("./ItemUsage", () => ({
  ItemUsage: ({ onSelectProject }: { onSelectProject: (path: string) => void }) => (
    <div data-testid="item-usage">
      <button type="button" onClick={() => onSelectProject("/repo/web")}>
        web
      </button>
    </div>
  ),
}));
// The lens's backend reads (load order and project usage), from the fixture's paths.
const lensPaths = vi.hoisted(() => ({ global: "", app: "" }));
vi.mock("./useLens", () => ({
  useLens: (project: { path: string } | null) =>
    project
      ? {
          effective: [
            { layer: "global", path: lensPaths.global, name: "CLAUDE.md", grade: "B", file_id: null },
            { layer: "project", path: lensPaths.app, name: "CLAUDE.md", grade: "C", file_id: null },
          ],
          usage: { ranked: [], sessions_per_day: [] },
          loading: false,
          failed: false,
        }
      : { effective: null, usage: null, loading: false, failed: false },
}));
// One handler registry per test so a case can emit `scan-done` like the core does.
const listeners = vi.hoisted(() => new Map<string, Set<() => void>>());
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: () => void) => {
    // A set per event: the inventory and the grade badge both listen for `scan-done`.
    const handlers = listeners.get(event) ?? new Set();
    handlers.add(handler);
    listeners.set(event, handlers);
    return Promise.resolve(() => handlers.delete(handler));
  }),
}));

const emit = async (event: string) => {
  await act(async () => {
    listeners.get(event)?.forEach((handler) => handler());
  });
};

const getSetup = vi.hoisted(() => vi.fn());
const listFiles = vi.hoisted(() => vi.fn());
const getOverview = vi.hoisted(() => vi.fn());
const listTemplates = vi.hoisted(() => vi.fn());
const getEntitlement = vi.hoisted(() => vi.fn());
const getExtraScanFolders = vi.hoisted(() => vi.fn());
const setExtraScanFolders = vi.hoisted(() => vi.fn());
const scanNow = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return {
    ...actual,
    isTauri: true,
    commands: {
      getSetup,
      listFiles,
      getOverview,
      listTemplates,
      getEntitlement,
      getExtraScanFolders,
      setExtraScanFolders,
      scanNow,
    },
  };
});

const fixture = populated;
/** The global skill "adapt", and the web project's graded rule. */
const SKILL_ID = 2;
const RULE_FILE_ID = "f-web";
/** The lens cases: web is live, gone is missing from disk, api's agent loads only there. */
const APP_PATH = "/repo/web";
const APP_NAME = "web";
const MISSING_PROJECT_PATH = "/repo/gone";
const OTHER_PROJECT_ONLY_ITEM = "api-reviewer";
const GLOBAL_RULE_PATH = "/home/u/.claude/CLAUDE.md";
const GLOBAL_RULE_NAME = "global-style";
const APP_RULE_PATH = "/repo/web/CLAUDE.md";
const APP_RULE_NAME = "web-rules";
const withoutSkill = { ...fixture, global: fixture.global.filter((a) => a.id !== SKILL_ID) };

const renderSetup = async (navigate = vi.fn()) => {
  const view = render(<Setup navigate={navigate} />);
  await screen.findByRole("heading", { name: "Setup", level: 1 });
  await screen.findByRole("radiogroup", { name: "Kinds" });
  return { ...view, navigate };
};

/** Body rows of the table, in render order. */
const bodyRows = () => [...document.querySelectorAll<HTMLElement>("tbody tr.dt__row")];

/** The name cell's own text. */
const rowNames = () => bodyRows().map((row) => row.querySelector("td")?.textContent?.trim() ?? "");

const rowFor = (name: string) =>
  bodyRows().find((row) => (row.querySelector("td")?.textContent ?? "").startsWith(name)) as HTMLElement;

const pickKind = (label: RegExp) => fireEvent.click(screen.getByRole("radio", { name: label }));

/** The count a kind chip shows. */
const chipCount = (label: RegExp) =>
  screen.getByRole("radio", { name: label }).querySelector(".kind-chip__count")?.textContent;

/** The Kind cell of every body row (the Kind column shows on the All chip). */
function kindCells(): string[] {
  const col = screen.getAllByRole("columnheader").findIndex((h) => /Kind/.test(h.textContent ?? ""));
  return screen.getAllByRole("row").slice(1).map((r) => r.querySelectorAll("td")[col]?.textContent ?? "");
}

beforeEach(() => {
  vi.clearAllMocks();
  listeners.clear();
  window.sessionStorage.clear();
  getSetup.mockResolvedValue({ status: "ok", data: populated });
  listFiles.mockResolvedValue({ status: "ok", data: [] });
  getOverview.mockResolvedValue({ status: "ok", data: { has_data: true, overall_grade: "C" } });
  listTemplates.mockResolvedValue([]);
  getEntitlement.mockResolvedValue({ status: "ok", data: { paid: false } });
  getExtraScanFolders.mockResolvedValue({ status: "ok", data: [] });
  setExtraScanFolders.mockResolvedValue({ status: "ok", data: null });
  scanNow.mockResolvedValue({ status: "error", error: "no" });
  open.mockResolvedValue(null);
  lensPaths.global = GLOBAL_RULE_PATH;
  lensPaths.app = APP_RULE_PATH;
});

afterEach(cleanup);

describe("Setup", () => {
  it("shows one table with kind chips instead of tabs", () => {
    render(<Setup navigate={vi.fn()} data={fixture} files={[]} />);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.getByRole("radiogroup", { name: "Kinds" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^All/ })).toHaveAttribute("aria-checked", "true");
  });

  it("counts every kind on its chip, across global and every project", () => {
    render(<Setup navigate={vi.fn()} data={fixture} files={[]} />);
    expect(chipCount(/^All/)).toBe("13");
    expect(chipCount(/^Instructions/)).toBe("2");
    expect(chipCount(/^Skills/)).toBe("5");
    expect(chipCount(/^Agents/)).toBe("1");
    expect(chipCount(/^Commands/)).toBe("0");
    expect(chipCount(/^MCP servers/)).toBe("1");
    expect(chipCount(/^Hooks/)).toBe("1");
    expect(chipCount(/^Plugins/)).toBe("2");
    expect(chipCount(/^Config/)).toBe("1");
  });

  it("summarises the detected harness, and says when it was last scanned in the header only", async () => {
    await renderSetup();

    expect(screen.getByText(/Claude Code · 2 projects · 177 sessions/)).toBeInTheDocument();
    const header = document.querySelector("header.screen__toolbar") as HTMLElement;
    expect(within(header).getByText(/^scanned /)).toBeInTheDocument();
    expect(screen.getAllByText(/scan(ned)? .*ago|last scan/i)).toHaveLength(1);
  });

  it("shows the overall grade and the slice's item count on the summary line", async () => {
    await renderSetup();

    expect(await screen.findByText("C", { selector: ".summary-grade" })).toBeInTheDocument();
    expect(screen.getByText("13 items")).toBeInTheDocument();
    pickKind(/^Skills/);
    expect(screen.getByText("5 items")).toBeInTheDocument();
  });

  it("narrows to one kind from a chip and from a deep link", () => {
    const { rerender } = render(<Setup navigate={vi.fn()} data={fixture} files={[]} />);
    fireEvent.click(screen.getByRole("radio", { name: /Skills/ }));
    expect(screen.queryByRole("columnheader", { name: /Kind/ })).toBeNull();
    rerender(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ kind: "mcp_server" }} />);
    expect(screen.getByRole("radio", { name: /MCP servers/ })).toHaveAttribute("aria-checked", "true");
  });

  it("lands on the status filter a deep link names", () => {
    render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ kind: "skill", filter: "never" }} />);

    expect(screen.getByRole("button", { name: /never used/ })).toHaveAttribute("aria-pressed", "true");
    expect(rowNames()).toEqual(["brainstorming", "brainstorming", "sunset"]);
  });

  it("filters to never-used items from the summary line, usage kinds only", () => {
    render(<Setup navigate={vi.fn()} data={fixture} files={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /never used/ }));
    const kinds = kindCells();
    expect(kinds.length).toBeGreaterThan(0);
    const usage = ["Skill", "Agent", "Command", "MCP server"];
    for (const k of kinds) expect(usage).toContain(k);
    for (const row of screen.getAllByRole("row").slice(1)) expect(row).not.toHaveTextContent(/^adapt/);
  });

  it("orders the All slice by kind in chip order (then name, pinned in setupRows.util.test.ts)", () => {
    render(<Setup navigate={vi.fn()} data={fixture} files={[]} />);
    const kinds = kindCells();
    const rank = (k: string) => KIND_CHIP_ORDER.findIndex((c) => c !== "all" && KIND_SINGULAR[c] === k);
    const ranks = kinds.map(rank);
    expect(new Set(kinds).size).toBeGreaterThan(1);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });

  it("orders a single kind by name too", async () => {
    await renderSetup();
    pickKind(/^Skills/);

    expect(rowNames()).toEqual(["adapt", "brainstorming", "brainstorming", "deploy", "sunset"]);
  });

  it("scopes each Skills row to the global layer or to its project", async () => {
    await renderSetup();
    pickKind(/^Skills/);

    expect(within(rowFor("adapt")).getByText("Global")).toBeInTheDocument();
    expect(within(rowFor("deploy")).getByText("web")).toBeInTheDocument();
  });

  it("narrows every kind to one project with the Scope filter", async () => {
    await renderSetup();

    pickFilter("Scope", "web");

    expect(rowNames()).toEqual(["web-rules", "deploy"]);
  });

  it("narrows a kind to one plugin with the Scope filter", async () => {
    await renderSetup();
    pickKind(/^Skills/);

    pickFilter("Scope", "posthog");

    expect(rowNames()).toEqual(["brainstorming"]);
    expect(within(rowFor("brainstorming")).getByText("posthog")).toBeInTheDocument();
  });

  it("searches by name, description and scope", async () => {
    await renderSetup();
    pickKind(/^Skills/);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "screen sizes" } });
    await waitFor(() => expect(rowNames()).toEqual(["adapt"]));

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "web" } });
    await waitFor(() => expect(rowNames()).toEqual(["deploy"]));
  });

  it("searches by path, finding a row whose name and scope say nothing of it", async () => {
    await renderSetup();

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "web/.claude/skills" } });

    await waitFor(() => expect(rowNames()).toEqual(["deploy"]));
  });

  it("names the plugin a bundled row came from, telling same-named skills apart", async () => {
    await renderSetup();
    pickKind(/^Skills/);

    const bundled = bodyRows().filter((row) => (row.querySelector("td")?.textContent ?? "").startsWith("brainstorming"));
    expect(bundled).toHaveLength(2);
    expect(bundled.map((row) => within(row).getByText(/^(superpowers|posthog)$/).textContent).sort()).toEqual([
      "posthog",
      "superpowers",
    ]);
  });

  it("finds a bundled row by the plugin that installed it", async () => {
    await renderSetup();
    pickKind(/^Skills/);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "posthog" } });

    await waitFor(() => expect(rowNames()).toEqual(["brainstorming"]));
  });

  it("lists settings files under Config", async () => {
    await renderSetup();
    pickKind(/^Config/);

    expect(rowNames()).toEqual(["settings.json"]);
    expect(within(rowFor("settings.json")).getByText("Global")).toBeInTheDocument();
  });

  it("opens a graded instruction in the viewer instead of Detail", () => {
    const navigate = vi.fn();
    render(<Setup navigate={navigate} data={fixture} files={[]} />);
    fireEvent.click(screen.getByRole("radio", { name: /Instructions/ }));
    fireEvent.click(screen.getAllByRole("row")[1]);
    expect(navigate).not.toHaveBeenCalledWith("detail", expect.anything());
    expect(screen.getByRole("tablist", { name: /viewer/i })).toBeInTheDocument();
  });

  it("opens the item a deep link names, on the tab it names", () => {
    render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ open: { artifactId: SKILL_ID }, tab: "usage" }} />);
    expect(screen.getByRole("tab", { name: "Usage" })).toHaveAttribute("aria-selected", "true");
  });

  it("opens a file by its file id (the panel's Fix these next link)", () => {
    render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ open: { fileId: RULE_FILE_ID }, tab: "findings" }} />);
    expect(screen.getByRole("tab", { name: /Findings/ })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps a deep link pending until its item's rows arrive, then opens it", () => {
    const target = { open: { artifactId: SKILL_ID }, tab: "content" as const };
    const { rerender } = render(<Setup navigate={vi.fn()} data={withoutSkill} files={[]} target={target} loading />);
    expect(screen.queryByRole("tablist", { name: /viewer/i })).toBeNull();
    rerender(<Setup navigate={vi.fn()} data={fixture} files={[]} target={target} />);
    expect(screen.getByRole("tablist", { name: /viewer/i })).toBeInTheDocument();
  });

  it("drops a deep link whose item is still missing once the load is done", () => {
    const target = { open: { artifactId: SKILL_ID } };
    const { rerender } = render(<Setup navigate={vi.fn()} data={withoutSkill} files={[]} target={target} />);
    // the load had already completed without the item: a later refresh that brings it back must not pop a sheet
    rerender(<Setup navigate={vi.fn()} data={fixture} files={[]} target={target} />);
    expect(screen.queryByRole("tablist", { name: /viewer/i })).toBeNull();
  });

  it("closes the viewer when a rescan removes the open item", () => {
    const { rerender } = render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ open: { artifactId: SKILL_ID } }} />);
    rerender(<Setup navigate={vi.fn()} data={withoutSkill} files={[]} target={{ open: { artifactId: SKILL_ID } }} />);
    expect(screen.queryByRole("tablist", { name: /viewer/i })).toBeNull();
  });

  it("stays closed when the removed item comes back on a later rescan", () => {
    const target = { open: { artifactId: SKILL_ID } };
    const { rerender } = render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={target} />);
    rerender(<Setup navigate={vi.fn()} data={withoutSkill} files={[]} target={target} />);
    rerender(<Setup navigate={vi.fn()} data={fixture} files={[]} target={target} />);
    expect(screen.queryByRole("tablist", { name: /viewer/i })).toBeNull();
  });

  it("steps through the rows on screen, in their order, and stops at the last", () => {
    render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ kind: "skill" }} />);
    fireEvent.click(rowFor("deploy"));
    expect(screen.getByRole("dialog")).toHaveAccessibleName(/^deploy/);
    fireEvent.click(screen.getByRole("button", { name: "Next item" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName(/^sunset/);
    fireEvent.click(screen.getByRole("button", { name: "Next item" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName(/^sunset/);
    fireEvent.click(screen.getByRole("button", { name: "Previous item" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName(/^deploy/);
  });

  it("steps over what the filters hide", () => {
    render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ kind: "skill", filter: "never" }} />);
    // never used: brainstorming, brainstorming, sunset — adapt and deploy are filtered out.
    fireEvent.click(bodyRows()[1]);
    fireEvent.click(screen.getByRole("button", { name: "Next item" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName(/^sunset/);
  });

  it("opens a stepped-to item on the tab the viewer was on, with the editor state of a fresh open", () => {
    render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ kind: "skill" }} />);
    fireEvent.click(rowFor("adapt"));
    fireEvent.click(screen.getByRole("tab", { name: "Usage" }));
    fireEvent.click(screen.getByRole("button", { name: "Next item" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName(/^brainstorming/);
    expect(screen.getByRole("tab", { name: "Usage" })).toHaveAttribute("aria-selected", "true");
  });

  it("lists a graded file the inventory never saw under Instructions", () => {
    const orphan = { id: "/x/AGENTS.md", name: "AGENTS.md", path: "/x/AGENTS.md", project: "x", project_id: "/x",
      kind: "AGENTS.md", grade: "D", score: 55, issue_count: 4, modified: null, worst_severity: "hi" } as FileRow;
    render(<Setup navigate={vi.fn()} data={fixture} files={[orphan]} />);
    fireEvent.click(screen.getByRole("radio", { name: /Instructions/ }));
    expect(screen.getByText("AGENTS.md")).toBeInTheDocument();
    expect(screen.getByLabelText("4 findings, worst critical")).toBeInTheDocument();
  });

  it("loads the graded files alongside the inventory", async () => {
    listFiles.mockResolvedValue({
      status: "ok",
      data: [{ id: "/x/AGENTS.md", name: "AGENTS.md", path: "/x/AGENTS.md", project: "x", project_id: "/x",
        kind: "AGENTS.md", grade: "D", score: 55, issue_count: 4, modified: null, worst_severity: "hi" }],
    });
    await renderSetup();
    pickKind(/^Instructions/);

    expect(rowNames()).toEqual(["AGENTS.md", "global-style", "web-rules"]);
  });

  it("offers New from template… on the Instructions chip only", () => {
    render(<Setup navigate={vi.fn()} data={fixture} files={[]} />);
    expect(screen.queryByRole("button", { name: "New from template…" })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Instructions/ }));
    expect(screen.getByRole("button", { name: "New from template…" })).toBeInTheDocument();
  });

  it("rebuilds the chips, rows and summary counts from the inventory a scan produced", async () => {
    await renderSetup();
    pickKind(/^Skills/);
    expect(screen.getByRole("button", { name: /never used/ })).toHaveTextContent("3 never used");

    // The rescan finds one more, never-used skill. Every derived value is
    // cached on the identity of what it was built from, so a screen that
    // updated the inventory in place would keep showing the old counts.
    getSetup.mockResolvedValue({
      status: "ok",
      data: {
        ...populated,
        global: [
          ...populated.global,
          artifact({ id: 99, kind: "skill", name: "zzz-new", path: "/home/u/.claude/skills/zzz-new/SKILL.md" }),
        ],
      },
    });

    await emit("scan-done");

    await waitFor(() => expect(getSetup).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(chipCount(/^Skills/)).toBe("6"));
    expect(rowNames()).toContain("zzz-new");
    expect(screen.getByRole("button", { name: /never used/ })).toHaveTextContent("4 never used");
  });

  it("says no items match when the chips and summary leave nothing, and one Clear filters resets them", () => {
    render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ kind: "rule", filter: "never" }} />);

    expect(screen.getByText("No items match")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(screen.getByRole("radio", { name: /^All/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: /never used/ })).toHaveAttribute("aria-pressed", "false");
    expect(bodyRows()).toHaveLength(13);
  });

  it("says no items match when the search leaves nothing, and Clear filters resets the search and the chips", async () => {
    await renderSetup();
    pickKind(/^Skills/);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "zzz-nothing" } });

    expect(await screen.findByText("No items match")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("radio", { name: /^All/ })).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(bodyRows()).toHaveLength(13));
  });

  it("says the setup has no items, not that nothing matches, when a detected harness has none", () => {
    render(<Setup navigate={vi.fn()} data={{ ...fixture, global: [], projects: [] }} files={[]} />);

    expect(screen.getByText(NO_ITEMS_TITLE)).toBeInTheDocument();
    expect(screen.queryByText("No items match")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear filters" })).not.toBeInTheDocument();
  });

  it("says no Claude Code setup was found, and offers Add folder…, when no harness was detected", async () => {
    getSetup.mockResolvedValue({ status: "ok", data: noHarness });
    render(<Setup navigate={vi.fn()} />);

    expect(await screen.findByRole("heading", { name: "No Claude Code setup found" })).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: LABEL.addFolder }));
    await waitFor(() => expect(open).toHaveBeenCalled());
  });

  it("stops loading when the setup query fails", async () => {
    getSetup.mockRejectedValue(new Error("no database"));
    render(<Setup navigate={vi.fn()} />);

    expect(await screen.findByText(/setup could not be read/i)).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderSetup();

    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("Setup under the project lens", () => {
  /** The Viewing control, whatever it currently reads. */
  const viewing = () => screen.getByRole("combobox", { name: /^Viewing/ });
  const pickLens = (option: string | RegExp) => {
    fireEvent.click(viewing());
    fireEvent.click(screen.getByRole("option", { name: option }));
  };
  /** The table toolbar's Scope filter trigger — not the Scope column's sort button. */
  const scopeFilter = () =>
    within(document.querySelector(".dt__toolbar") as HTMLElement).queryByLabelText(/^Scope/, {
      selector: ".fs__trigger",
    });
  const graded = (path: string, project: string, projectId: string): FileRow =>
    ({
      id: path,
      name: path.split("/").pop(),
      path,
      project,
      project_id: projectId,
      kind: "AGENTS.md",
      grade: "C",
      score: 70,
      issue_count: 1,
      modified: null,
      worst_severity: "lo",
    }) as FileRow;

  it("shows only what loads in the lensed project, instructions numbered first", () => {
    render(<Setup navigate={vi.fn()} data={withOtherProject} files={[]} target={{ lens: APP_PATH }} />);
    expect(screen.getByRole("columnheader", { name: "#" })).toBeInTheDocument();
    const body = bodyRows();
    // The "#" column comes first; the two effective instructions lead, in load order.
    expect(body.slice(0, 2).map((r) => r.querySelector("td")?.textContent)).toEqual(["1", "2"]);
    expect(body[0]).toHaveTextContent(GLOBAL_RULE_NAME);
    expect(body[1]).toHaveTextContent(APP_RULE_NAME);
    expect(screen.queryByText(OTHER_PROJECT_ONLY_ITEM)).toBeNull();
    // Global and this project's items are still there.
    expect(screen.getByText("deploy")).toBeInTheDocument();
    expect(screen.getByText("adapt")).toBeInTheDocument();
  });

  it("lists every project's items without the lens", () => {
    render(<Setup navigate={vi.fn()} data={withOtherProject} files={[]} />);
    expect(screen.getByText(OTHER_PROJECT_ONLY_ITEM)).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "#" })).toBeNull();
  });

  it("keeps this project's graded-only instruction file under the lens", () => {
    const files = [graded(`${APP_PATH}/AGENTS.md`, APP_NAME, APP_PATH), graded("/repo/api/AGENTS.md", "api", "/repo/api")];
    render(<Setup navigate={vi.fn()} data={withOtherProject} files={files} target={{ lens: APP_PATH }} />);
    const names = bodyRows().map((r) => r.textContent ?? "");
    // After the two numbered instructions, unnumbered; the api project's file is left out.
    expect(names.filter((t) => t.includes("AGENTS.md"))).toHaveLength(1);
    expect(bodyRows()[2]).toHaveTextContent("AGENTS.md");
    expect(bodyRows()[2].querySelector("td")?.textContent).toBe("");
  });

  it("hides the Scope filter under the lens and shows the project strip", () => {
    render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ lens: APP_PATH }} />);
    expect(scopeFilter()).toBeNull();
    expect(screen.getByRole("button", { name: "Reveal in Finder" })).toBeInTheDocument();
  });

  it("switches lens from the Viewing control", () => {
    render(<Setup navigate={vi.fn()} data={fixture} files={[]} />);
    expect(scopeFilter()).not.toBeNull();
    pickLens(new RegExp(APP_NAME));
    expect(viewing()).toHaveAccessibleName(new RegExp(`as Claude Code sees ${APP_NAME}`));
    expect(screen.getByRole("columnheader", { name: "#" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reveal in Finder" })).toBeInTheDocument();
  });

  it("shows the missing-folder message and an empty table for a project that is gone", () => {
    render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ lens: MISSING_PROJECT_PATH }} />);
    expect(screen.getByRole("status")).toHaveTextContent(/folder/i);
    expect(bodyRows()).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Reveal in Finder" })).toBeNull();
  });

  it("keeps one lens: the Viewing control and the table always agree", () => {
    render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ lens: APP_PATH }} />);
    expect(viewing()).toHaveAccessibleName(new RegExp(`as Claude Code sees ${APP_NAME}`));
    pickLens("All setup");
    expect(viewing()).toHaveAccessibleName(/All setup/);
    expect(screen.queryByRole("columnheader", { name: "#" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reveal in Finder" })).toBeNull();
    expect(scopeFilter()).not.toBeNull();
  });

  it("follows a deep link's lens while Setup is already mounted", () => {
    const { rerender } = render(<Setup navigate={vi.fn()} data={fixture} files={[]} />);
    rerender(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ lens: APP_PATH }} />);
    expect(viewing()).toHaveAccessibleName(new RegExp(`as Claude Code sees ${APP_NAME}`));
    expect(screen.getByRole("columnheader", { name: "#" })).toBeInTheDocument();
  });

  it("turns the lens on from the viewer's Usage tab", () => {
    const navigate = vi.fn();
    render(<Setup navigate={navigate} data={fixture} files={[]} target={{ open: { artifactId: SKILL_ID }, tab: "usage" }} />);
    fireEvent.click(within(screen.getByTestId("item-usage")).getByRole("button", { name: APP_NAME }));
    expect(navigate).not.toHaveBeenCalled();
    expect(viewing()).toHaveAccessibleName(new RegExp(`as Claude Code sees ${APP_NAME}`));
    expect(screen.getByRole("columnheader", { name: "#" })).toBeInTheDocument();
  });

  it("has no accessibility violations with the lens on", async () => {
    const { container } = render(<Setup navigate={vi.fn()} data={fixture} files={[]} target={{ lens: APP_PATH }} />);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("lenses a graded-only project path with no strip and no crash", () => {
    const path = "/not/in/the/inventory";
    const files = [graded(`${path}/AGENTS.md`, "side", path)];
    render(<Setup navigate={vi.fn()} data={fixture} files={files} target={{ lens: path }} />);
    expect(screen.queryByRole("button", { name: "Reveal in Finder" })).toBeNull();
    expect(screen.getByRole("radiogroup", { name: "Kinds" })).toBeInTheDocument();
    // The control names the lens rather than claiming "All setup", and the table is that project's.
    expect(viewing()).toHaveAccessibleName(/as Claude Code sees side/);
    expect(screen.getByText("AGENTS.md")).toBeInTheDocument();
    expect(screen.queryByText(APP_RULE_NAME)).toBeNull();
  });
});
