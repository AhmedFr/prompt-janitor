import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, within, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Setup } from "./Setup";
import type { ArtifactView, EffectiveRule, SetupView, UsageStat } from "@/lib/ipc";

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
const getEffectiveRules = vi.hoisted(() => vi.fn());
const getExtraScanFolders = vi.hoisted(() => vi.fn());
const setExtraScanFolders = vi.hoisted(() => vi.fn());
const scanNow = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return {
    ...actual,
    isTauri: true,
    commands: { getSetup, getEffectiveRules, getExtraScanFolders, setExtraScanFolders, scanNow },
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

const effectiveRules: EffectiveRule[] = [
  {
    layer: "global",
    path: "/home/u/.claude/CLAUDE.md",
    name: "home CLAUDE.md",
    grade: "B",
    file_id: "f-global",
  },
  {
    layer: "project",
    path: "/repo/web/CLAUDE.md",
    name: "web CLAUDE.md",
    grade: "C",
    file_id: "f-web",
  },
];

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
    artifact({ id: 1, kind: "rule", name: "global-style", grade: "B", file_id: "f-global" }),
    artifact({ id: 2, kind: "skill", name: "debugging", usage: usage({ avg_turn_tokens: 300 }) }),
    artifact({
      id: 3,
      kind: "mcp_server",
      name: "linear",
      usage: usage({ error_rate: 0.5, avg_turn_tokens: 9000 }),
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
          id: 4,
          layer: "project",
          kind: "rule",
          name: "web-rules",
          grade: "C",
          file_id: "f-web",
          usage: usage({ avg_turn_tokens: 300 }),
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

beforeEach(() => {
  vi.clearAllMocks();
  listeners.clear();
  getSetup.mockResolvedValue({ status: "ok", data: populated });
  getEffectiveRules.mockResolvedValue({ status: "ok", data: effectiveRules });
  getExtraScanFolders.mockResolvedValue({ status: "ok", data: [] });
  setExtraScanFolders.mockResolvedValue({ status: "ok", data: null });
  scanNow.mockResolvedValue({ status: "error", error: "no" });
  open.mockResolvedValue(null);
});

afterEach(cleanup);

describe("Setup", () => {
  it("renders the harness summary with a Global and a Projects section", async () => {
    await renderSetup();

    expect(await screen.findByRole("heading", { name: "Global", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Projects", level: 2 })).toBeInTheDocument();
    expect(screen.getByText(/Claude Code · 2 projects · 177 sessions/)).toBeInTheDocument();
    expect(screen.getByText("global-style")).toBeInTheDocument();
    expect(screen.getByText("linear")).toBeInTheDocument();
  });

  it("narrows the inventory when a filter chip is pressed", async () => {
    await renderSetup();
    await screen.findByText("debugging");

    fireEvent.click(screen.getByRole("button", { name: "Never used" }));

    expect(screen.getByRole("button", { name: "Never used" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("global-style")).toBeInTheDocument();
    expect(screen.queryByText("debugging")).not.toBeInTheDocument();
    expect(screen.queryByText("linear")).not.toBeInTheDocument();
  });

  it("marks a project whose folder is gone and shows its session recency", async () => {
    await renderSetup();

    const gone = await screen.findByText("gone");
    expect(gone.closest("summary")).toHaveTextContent("folder missing");
    expect(screen.getByText("web").closest("summary")).toHaveTextContent("12 sessions");
  });

  it("loads a project's effective rules only once it is expanded", async () => {
    const { navigate } = await renderSetup();
    await screen.findByText("web");
    expect(getEffectiveRules).not.toHaveBeenCalled();

    const web = screen.getByText("web").closest("details") as HTMLDetailsElement;
    fireEvent.click(screen.getByText("web"));

    await waitFor(() =>
      expect(getEffectiveRules).toHaveBeenCalledWith("claude_code", "/repo/web"),
    );
    expect(
      within(web).getByRole("heading", { name: "Effective rules", level: 3 }),
    ).toBeInTheDocument();
    expect(await within(web).findByText("home CLAUDE.md")).toBeInTheDocument();

    fireEvent.click(within(web).getByRole("button", { name: /web CLAUDE\.md/ }));
    expect(navigate).toHaveBeenCalledWith("detail", "f-web");
  });

  it("offers a folder picker when no harness was detected", async () => {
    getSetup.mockResolvedValue({ status: "ok", data: noHarness });
    await renderSetup();

    expect(
      await screen.findByText("No supported agent harness found"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Global", level: 2 })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Add a folder/ }));
    await waitFor(() => expect(open).toHaveBeenCalled());
  });


  it("keeps a collapsed project's artifacts out of the DOM", async () => {
    await renderSetup();
    const web = (await screen.findByText("web")).closest("details") as HTMLDetailsElement;

    expect(web.querySelectorAll(".artifact-card")).toHaveLength(0);

    fireEvent.click(screen.getByText("web"));

    await waitFor(() => expect(web.querySelectorAll(".artifact-card").length).toBeGreaterThan(0));
  });

  it("reloads an expanded project's rules after a scan finishes", async () => {
    await renderSetup();
    await screen.findByText("web");
    fireEvent.click(screen.getByText("web"));
    await waitFor(() => expect(getEffectiveRules).toHaveBeenCalledTimes(1));

    await emit("scan-done");

    await waitFor(() => expect(getEffectiveRules).toHaveBeenCalledTimes(2));
    expect(getEffectiveRules).toHaveBeenLastCalledWith("claude_code", "/repo/web");
  });

  it("measures high cost against the whole setup, not one section", async () => {
    await renderSetup();
    await screen.findByText("linear");

    fireEvent.click(screen.getByRole("button", { name: "High cost" }));

    // Turn costs across global + projects are 300, 9000 and 300 — median 300,
    // so the bar is 600. Scoped to the global list alone the median would be
    // 4650 and nothing would clear it.
    expect(screen.getByText("linear")).toBeInTheDocument();
    expect(screen.queryByText("debugging")).not.toBeInTheDocument();
  });

  it("does not cache a failed rule lookup", async () => {
    getEffectiveRules.mockRejectedValueOnce(new Error("db is busy"));
    await renderSetup();
    const web = (await screen.findByText("web")).closest("details") as HTMLDetailsElement;

    fireEvent.click(screen.getByText("web"));
    expect(await within(web).findByText(/no rule files apply/i)).toBeInTheDocument();

    // Collapse and reopen: the failed key must not have been memoised. Wait on
    // the body unmounting, not on `details.open` — the DOM flag flips
    // synchronously on click, well before React has seen the toggle event.
    fireEvent.click(screen.getByText("web"));
    await waitFor(() => expect(within(web).queryByText(/no rule files apply/i)).toBeNull());
    fireEvent.click(screen.getByText("web"));

    await waitFor(() => expect(getEffectiveRules).toHaveBeenCalledTimes(2));
    expect(await within(web).findByText("home CLAUDE.md")).toBeInTheDocument();
  });

  it("stops loading when the setup query fails", async () => {
    getSetup.mockRejectedValue(new Error("no database"));
    await renderSetup();

    expect(await screen.findByText(/setup could not be read/i)).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderSetup();
    await screen.findByText("web");
    fireEvent.click(screen.getByText("web"));
    await screen.findByText("home CLAUDE.md");

    expect(await axe(container)).toHaveNoViolations();
  });
});
