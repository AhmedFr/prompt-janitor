import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import { filterOption, filterTrigger, openFilterGroup, pickFilter } from "@/test/filters";
import { Setup } from "./Setup";
import type { ArtifactView, SetupView, UsageStat } from "@/lib/ipc";

const open = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-dialog", () => ({ open }));
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

const getSetup = vi.hoisted(() => vi.fn());
const getExtraScanFolders = vi.hoisted(() => vi.fn());
const setExtraScanFolders = vi.hoisted(() => vi.fn());
const scanNow = vi.hoisted(() => vi.fn());
const getArtifactSource = vi.hoisted(() => vi.fn());
const saveArtifactSource = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return {
    ...actual,
    isTauri: true,
    commands: {
      getSetup,
      getExtraScanFolders,
      setExtraScanFolders,
      scanNow,
      getArtifactSource,
      saveArtifactSource,
    },
  };
});

const usage = (o: Partial<UsageStat> = {}): UsageStat => ({
  total: 9,
  sessions: 4,
  last_used: "2026-08-19T10:00:00.000Z",
  error_rate: 0,
  avg_turn_tokens: null,
  count_30d: 2,
  count_prev_30d: 1,
  ...o,
});

const artifact = (o: Partial<ArtifactView> = {}): ArtifactView => ({
  id: 1,
  harness: "claude_code",
  layer: "global",
  kind: "rule",
  name: "a",
  path: "/a.md",
  plugin_name: null,
  description: null,
  bytes: 10,
  grade: null,
  score: null,
  file_id: null,
  usage: null,
  ...o,
});

const populated: SetupView = {
  harnesses: [
    {
      id: "claude_code",
      display_name: "Claude Code",
      detected: true,
      last_scan_at: "2026-08-20T09:00:00.000Z",
      project_count: 2,
      session_count: 177,
    },
  ],
  global: [
    artifact({
      id: 1,
      kind: "rule",
      name: "global-style",
      path: "/home/u/.claude/CLAUDE.md",
      grade: "B",
      file_id: "f-global",
    }),
    artifact({
      id: 2,
      kind: "skill",
      name: "adapt",
      description: "Adapts designs across screen sizes",
      path: "/home/u/.claude/skills/adapt/SKILL.md",
      usage: usage({ total: 20, avg_turn_tokens: 300 }),
    }),
    artifact({
      id: 3,
      kind: "skill",
      name: "sunset",
      path: "/home/u/.claude/skills/sunset/SKILL.md",
      usage: null,
    }),
    artifact({
      id: 4,
      kind: "skill",
      name: "brainstorming",
      layer: "plugin",
      plugin_name: "superpowers",
      path: "/home/u/.claude/plugins/superpowers/skills/brainstorming/SKILL.md",
      usage: null,
    }),
    artifact({
      id: 5,
      kind: "agent",
      name: "code-reviewer",
      layer: "plugin",
      plugin_name: "superpowers",
      path: "/home/u/.claude/plugins/superpowers/agents/code-reviewer.md",
      usage: null,
    }),
    artifact({
      id: 6,
      kind: "mcp_server",
      name: "linear",
      path: "/home/u/.claude/mcp/linear",
      usage: usage({ error_rate: 0.5, avg_turn_tokens: 9000 }),
    }),
    artifact({ id: 7, kind: "hook", name: "PreToolUse: fmt", path: "/home/u/.claude/settings.json" }),
    artifact({
      id: 8,
      kind: "plugin",
      name: "superpowers",
      layer: "plugin",
      plugin_name: "superpowers",
      description: "v6.3.0 · claude-plugins-official",
      path: "/home/u/.claude/plugins/superpowers",
    }),
    artifact({
      id: 15,
      kind: "plugin",
      name: "posthog",
      layer: "plugin",
      plugin_name: "posthog",
      description: "v2.1.0 · posthog-marketplace",
      path: "/home/u/.claude/plugins/posthog",
    }),
    // Same skill name as superpowers' — only the plugin it came from tells
    // the two rows apart.
    artifact({
      id: 16,
      kind: "skill",
      name: "brainstorming",
      layer: "plugin",
      plugin_name: "posthog",
      path: "/home/u/.claude/plugins/posthog/skills/brainstorming/SKILL.md",
      usage: null,
    }),
    artifact({
      id: 17,
      kind: "settings",
      name: "settings.json",
      path: "/home/u/.claude/settings.json",
      bytes: 512,
    }),
  ],
  projects: [
    {
      harness: "claude_code",
      path: "/repo/web",
      name: "web",
      exists: true,
      session_count: 12,
      last_session_at: "2026-08-19T08:00:00.000Z",
      artifacts: [
        artifact({
          id: 9,
          layer: "project",
          kind: "rule",
          name: "web-rules",
          path: "/repo/web/CLAUDE.md",
          grade: "C",
          file_id: "f-web",
        }),
        artifact({
          id: 10,
          layer: "project",
          kind: "skill",
          name: "deploy",
          path: "/repo/web/.claude/skills/deploy/SKILL.md",
          usage: usage({ total: 30, avg_turn_tokens: 300 }),
        }),
      ],
    },
    {
      harness: "claude_code",
      path: "/repo/gone",
      name: "gone",
      exists: false,
      session_count: 1,
      last_session_at: "2026-07-01T08:00:00.000Z",
      artifacts: [],
    },
  ],
};

const noHarness: SetupView = {
  harnesses: [
    {
      id: "claude_code",
      display_name: "Claude Code",
      detected: false,
      last_scan_at: null,
      project_count: 0,
      session_count: 0,
    },
  ],
  global: [],
  projects: [],
};

const renderSetup = async (navigate = vi.fn()) => {
  const view = render(<Setup navigate={navigate} />);
  await screen.findByRole("heading", { name: "Setup", level: 1 });
  return { ...view, navigate };
};

/** Body rows of whichever tab's table is mounted, in render order. */
const bodyRows = () => [...document.querySelectorAll<HTMLElement>("tbody tr.dt__row")];

/** The name cell's own text, with the muted description suffix stripped. */
const rowNames = () =>
  bodyRows().map((row) => row.querySelector("td")?.textContent?.split("·")[0].trim() ?? "");

const rowFor = (name: string) =>
  bodyRows().find((row) => (row.querySelector("td")?.textContent ?? "").startsWith(name)) as HTMLElement;

const openTab = (label: RegExp) => fireEvent.click(screen.getByRole("tab", { name: label }));

beforeEach(() => {
  vi.clearAllMocks();
  listeners.clear();
  window.sessionStorage.clear();
  getSetup.mockResolvedValue({ status: "ok", data: populated });
  getExtraScanFolders.mockResolvedValue({ status: "ok", data: [] });
  setExtraScanFolders.mockResolvedValue({ status: "ok", data: null });
  scanNow.mockResolvedValue({ status: "error", error: "no" });
  getArtifactSource.mockResolvedValue({
    status: "ok",
    data: {
      path: "/s/SKILL.md",
      content: "# From disk\n",
      bytes: 12,
      modified: "111",
      format: "markdown",
      editable: true,
    },
  });
  saveArtifactSource.mockResolvedValue({ status: "ok", data: { bytes: 20 } });
  open.mockResolvedValue(null);
});

afterEach(cleanup);

describe("Setup", () => {
  it("renders one tab per artifact kind, counted across global and every project", async () => {
    await renderSetup();

    const tabs = await screen.findByRole("tablist", { name: /setup/i });
    // Accessible names, not text content: the badge is hidden from the name
    // and spelled out, so a tab reads as "Rules, 2" rather than "Rules2".
    expect(
      within(tabs)
        .getAllByRole("tab")
        .map((tab) => tab.getAttribute("aria-label")),
    ).toEqual([
      "Rules, 2",
      "Skills, 5",
      "Agents, 1",
      "Commands, 0",
      "Hooks, 1",
      "MCP, 1",
      "Plugins, 2",
      "Settings, 1",
    ]);
    expect(within(tabs).getByRole("tab", { name: "Rules, 2" })).toBeInTheDocument();
  });

  it("summarises the detected harness and when it was last scanned", async () => {
    await renderSetup();

    expect(screen.getByText(/Claude Code · 2 projects · 177 sessions/)).toBeInTheDocument();
    expect(screen.getByText(/last scan/i)).toBeInTheDocument();
  });

  it("opens on Rules, ordered best grade first", async () => {
    await renderSetup();
    await screen.findByRole("tab", { name: /^Rules/ });

    expect(screen.getByRole("tab", { name: /^Rules/ })).toHaveAttribute("aria-selected", "true");
    expect(rowNames()).toEqual(["global-style", "web-rules"]);
  });

  it("scopes each Skills row to the global layer or to its project", async () => {
    await renderSetup();
    openTab(/^Skills/);

    expect(within(rowFor("adapt")).getByText("Global")).toBeInTheDocument();
    expect(within(rowFor("deploy")).getByText("web")).toBeInTheDocument();
  });

  it("sorts every non-rule tab by uses, most-used first", async () => {
    await renderSetup();
    openTab(/^Skills/);

    // 30, 20, then the never-used rows in inventory order.
    expect(rowNames()).toEqual(["deploy", "adapt", "sunset", "brainstorming", "brainstorming"]);
    expect(screen.getByRole("columnheader", { name: /Uses/ })).toHaveAttribute(
      "aria-sort",
      "descending",
    );
  });

  it("narrows a tab to one project with the Scope filter", async () => {
    await renderSetup();
    openTab(/^Skills/);

    pickFilter("Scope", "web");

    expect(rowNames()).toEqual(["deploy"]);
  });

  it("narrows a tab to what has never been used", async () => {
    await renderSetup();
    openTab(/^Skills/);

    pickFilter("Status", "Never used");

    expect(rowNames()).toEqual(["sunset", "brainstorming", "brainstorming"]);
  });

  it("searches a tab by name, description and scope", async () => {
    await renderSetup();
    openTab(/^Skills/);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "screen sizes" } });
    await waitFor(() => expect(rowNames()).toEqual(["adapt"]));

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "web" } });
    await waitFor(() => expect(rowNames()).toEqual(["deploy"]));
  });

  it("counts what a plugin install bundled on its Plugins row", async () => {
    await renderSetup();
    openTab(/^Plugins/);

    // The bundled skill and agent — not the plugin's own manifest row.
    expect(within(rowFor("superpowers")).getByText("2")).toBeInTheDocument();
  });

  it("names the plugin a bundled row came from, telling same-named skills apart", async () => {
    await renderSetup();
    openTab(/^Skills/);

    const bundled = bodyRows().filter((row) =>
      (row.querySelector("td")?.textContent ?? "").startsWith("brainstorming"),
    );
    expect(bundled).toHaveLength(2);
    expect(
      bundled.map((row) => within(row).getByText(/^(superpowers|posthog)$/).textContent).sort(),
    ).toEqual(["posthog", "superpowers"]);
  });

  it("finds a bundled row by the plugin that installed it", async () => {
    await renderSetup();
    openTab(/^Skills/);

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "posthog" } });

    await waitFor(() => expect(rowNames()).toEqual(["brainstorming"]));
  });

  it("narrows a tab to one plugin with the Scope filter", async () => {
    await renderSetup();
    openTab(/^Skills/);

    pickFilter("Scope", "posthog");

    expect(rowNames()).toEqual(["brainstorming"]);
    expect(within(rowFor("brainstorming")).getByText("posthog")).toBeInTheDocument();
  });

  it("gives settings files a tab of their own", async () => {
    await renderSetup();
    openTab(/^Settings/);

    expect(rowNames()).toEqual(["settings.json"]);
    expect(within(rowFor("settings.json")).getByText("Global")).toBeInTheDocument();
  });

  it("lets a deep link win over the remembered tab", async () => {
    // The user last left Setup on Skills; arriving from a "show me the MCP
    // servers" link has to override that, not lose to it.
    window.sessionStorage.setItem("pj.tabs.setup", "skill");
    render(<Setup navigate={vi.fn()} initialTab="mcp_server" />);
    await screen.findByRole("heading", { name: "Setup", level: 1 });

    await waitFor(() =>
      expect(screen.getByRole("tab", { name: /^MCP/ })).toHaveAttribute("aria-selected", "true"),
    );
    expect(rowNames()).toEqual(["linear"]);
  });

  it("opens a rule's detail when its row is clicked", async () => {
    const { navigate } = await renderSetup();
    await screen.findByRole("tab", { name: /^Rules/ });

    fireEvent.click(rowFor("web-rules"));

    expect(navigate).toHaveBeenCalledWith("detail", "f-web");
  });

  it("keeps each tab's filters to itself, even between tabs with the same pill groups", async () => {
    await renderSetup();
    openTab(/^Skills/);
    pickFilter("Status", "Never used");
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "sunset" } });
    await waitFor(() => expect(rowNames()).toEqual(["sunset"]));

    // Agents carries the very same pill group ids ("scope", "status",
    // "bundled") and the same search config, so a table keyed on anything
    // coarser than its own `stateKey` would arrive here already filtered.
    openTab(/^Agents/);

    expect(rowNames()).toEqual(["code-reviewer"]);
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(filterTrigger("Status")).toHaveAccessibleName("Status");
    // Nothing was typed or pressed on this tab, so it has nothing to remember.
    expect(window.sessionStorage.getItem("pj.table.setup.agent")).toBeNull();

    openTab(/^Skills/);

    expect(rowNames()).toEqual(["sunset"]);
    expect(screen.getByRole("searchbox")).toHaveValue("sunset");
    expect(filterTrigger("Status")).toHaveAccessibleName("Status, Never used");
  });

  it("rebuilds the tabs, rows and pill counts from the inventory a scan produced", async () => {
    await renderSetup();
    openTab(/^Skills/);
    openFilterGroup("Status");
    expect(filterOption("Never used")).toHaveAccessibleName("Never used, 3");
    fireEvent.click(filterTrigger("Status"));

    // The rescan finds one more, never-used skill. Every derived value here
    // is cached on the identity of what it was built from — the row arrays,
    // the column context, the pill definitions — so a screen that updated
    // the inventory in place instead of replacing it would keep showing the
    // counts, tabs and rows below from before the scan.
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
    await waitFor(() =>
      expect(screen.getByRole("tab", { name: "Skills, 6" })).toHaveTextContent("Skills6"),
    );
    expect(rowNames()).toContain("zzz-new");
    openFilterGroup("Status");
    expect(filterOption("Never used")).toHaveAccessibleName("Never used, 4");
  });

  it("offers a folder picker when no harness was detected", async () => {
    getSetup.mockResolvedValue({ status: "ok", data: noHarness });
    await renderSetup();

    expect(await screen.findByText("No supported agent harness found")).toBeInTheDocument();
    expect(screen.queryByRole("tablist")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Add a folder/ }));
    await waitFor(() => expect(open).toHaveBeenCalled());
  });

  it("stops loading when the setup query fails", async () => {
    getSetup.mockRejectedValue(new Error("no database"));
    await renderSetup();

    expect(await screen.findByText(/setup could not be read/i)).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  describe("the skill panel", () => {
    /** Open the Skills tab and click the `adapt` row. */
    const openAdapt = async () => {
      await renderSetup();
      await screen.findByRole("tablist", { name: /setup/i });
      openTab(/^Skills/);
      fireEvent.click(rowFor("adapt"));
      return await screen.findByRole("dialog");
    };

    it("opens when a skill row is clicked, showing that skill's file", async () => {
      const panel = await openAdapt();

      expect(panel).toHaveAccessibleName(/adapt/);
      // Keyed on the row's artifact id, which is what the command takes.
      await waitFor(() => expect(getArtifactSource).toHaveBeenCalledWith(2));
      expect(await within(panel).findByRole("heading", { name: "From disk" })).toBeInTheDocument();
    });

    it("closes again, and stops asking for the file", async () => {
      const panel = await openAdapt();
      fireEvent.click(within(panel).getByRole("button", { name: "Close" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("refreshes the inventory after a save, so Size stops showing the old count", async () => {
      const panel = await openAdapt();
      await within(panel).findByRole("heading", { name: "From disk" });
      const before = getSetup.mock.calls.length;

      fireEvent.click(within(panel).getByRole("button", { name: "Edit" }));
      fireEvent.change(within(panel).getByRole("textbox", { name: /markdown/i }), {
        target: { value: "# Edited" },
      });
      fireEvent.click(within(panel).getByRole("button", { name: "Save" }));

      await waitFor(() => expect(saveArtifactSource).toHaveBeenCalledWith(2, "# Edited", "111"));
      await waitFor(() => expect(getSetup.mock.calls.length).toBeGreaterThan(before));
    });

    /**
     * Editing a skill's `name:` frontmatter changes what the row is called.
     * The panel header has to follow the refreshed inventory rather than the
     * snapshot it was opened with, or it keeps announcing the old name until
     * the user closes and reopens it.
     */
    it("follows the refreshed row after a save, rather than the row it opened with", async () => {
      const panel = await openAdapt();
      await within(panel).findByRole("heading", { name: "From disk" });

      // The rescan-shaped refetch that follows a save returns a renamed skill.
      const renamed = {
        ...populated,
        global: populated.global.map((a) => (a.id === 2 ? { ...a, name: "adapts" } : a)),
      };
      getSetup.mockResolvedValue({ status: "ok", data: renamed });

      fireEvent.click(within(panel).getByRole("button", { name: "Edit" }));
      fireEvent.change(within(panel).getByRole("textbox", { name: /markdown/i }), {
        target: { value: "# Edited" },
      });
      fireEvent.click(within(panel).getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(screen.getByRole("dialog")).toHaveAccessibleName(/adapts/),
      );
    });

    it("closes itself if the skill is gone from the inventory after a rescan", async () => {
      await openAdapt();

      getSetup.mockResolvedValue({
        status: "ok",
        data: { ...populated, global: populated.global.filter((a) => a.id !== 2) },
      });
      await emit("scan-done");

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

  });

  describe("the detail sheet", () => {
    it.each([
      [/^MCP/, "linear", 6, "linear — MCP server"],
      [/^Hooks/, "PreToolUse: fmt", 7, "PreToolUse: fmt — Hook"],
      [/^Agents/, "code-reviewer", 5, "code-reviewer — Agent"],
      [/^Plugins/, "superpowers", 8, "superpowers — Plugin"],
    ])("opens read-only for a row on the %s tab", async (tab, name, id, label) => {
      getArtifactSource.mockResolvedValue({
        status: "ok",
        data: { path: "/x", content: '{ "command": "npx" }', bytes: 20, modified: "1", format: "json", editable: false },
      });
      await renderSetup();
      await screen.findByRole("tablist", { name: /setup/i });
      openTab(tab);
      fireEvent.click(rowFor(name));

      const sheet = await screen.findByRole("dialog");
      expect(sheet).toHaveAccessibleName(label);
      await waitFor(() => expect(getArtifactSource).toHaveBeenCalledWith(id));
      expect(within(sheet).queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    });

    it("shows what the inventory knows about the row, usage included", async () => {
      await renderSetup();
      await screen.findByRole("tablist", { name: /setup/i });
      openTab(/^MCP/);
      fireEvent.click(rowFor("linear"));

      const sheet = await screen.findByRole("dialog");
      expect(within(sheet).getByText("Error rate")).toBeInTheDocument();
      expect(within(sheet).getByText("50%")).toBeInTheDocument();
    });

    it("closes on Escape", async () => {
      await renderSetup();
      await screen.findByRole("tablist", { name: /setup/i });
      openTab(/^MCP/);
      fireEvent.click(rowFor("linear"));

      fireEvent.keyDown(await screen.findByRole("dialog"), { key: "Escape" });
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderSetup();
    await screen.findByRole("tablist", { name: /setup/i });
    openTab(/^Skills/);

    expect(await axe(container)).toHaveNoViolations();
  });
});
