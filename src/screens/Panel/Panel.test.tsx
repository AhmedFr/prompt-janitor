import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { PanelSnapshot } from "@/lib/ipc";
import { Panel } from "./Panel";

// One handler registry per test so a case can emit `scan-done` like the core does.
const listeners = vi.hoisted(() => new Map<string, (event?: unknown) => void>());
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: (payload?: unknown) => void) => {
    listeners.set(event, handler);
    return Promise.resolve(() => listeners.delete(event));
  }),
}));

// The panel is the only screen that drives its own window: Esc hides it, and
// being shown again arrives as a focus change.
const win = vi.hoisted(() => ({
  hide: vi.fn(),
  onFocus: null as null | ((event: { payload: boolean }) => void),
}));
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    hide: win.hide,
    onFocusChanged: (handler: (event: { payload: boolean }) => void) => {
      win.onFocus = handler;
      return Promise.resolve(() => {
        win.onFocus = null;
      });
    },
  }),
}));

const getPanelSnapshot = vi.hoisted(() => vi.fn());
const openMain = vi.hoisted(() => vi.fn());
const quit = vi.hoisted(() => vi.fn());
const scanNow = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return {
    ...actual,
    isTauri: true,
    commands: { getPanelSnapshot, openMain, quit, scanNow },
  };
});

const HOURS_AGO_2 = new Date(Date.now() - 2 * 3_600_000).toISOString();

const snapshot = (o: Partial<PanelSnapshot> = {}): PanelSnapshot => ({
  has_data: true,
  overall_grade: "C",
  overall_score: 72,
  delta: 3,
  last_scan_at: HOURS_AGO_2,
  top_fixes: [
    {
      file_id: "/code/acme-api/CLAUDE.md",
      name: "CLAUDE.md",
      project_name: "acme-api",
      grade: "F",
      issue_count: 6,
    },
    {
      file_id: "/code/web-app/AGENTS.md",
      name: "AGENTS.md",
      project_name: "web-app",
      grade: "D",
      issue_count: 4,
    },
    {
      file_id: "/code/web-app/.claude/skills/deploy/SKILL.md",
      name: "SKILL.md",
      project_name: "web-app",
      grade: "C",
      issue_count: 2,
    },
  ],
  never_used_skills: 3,
  mcp_erroring: 1,
  sessions_today: 12,
  ...o,
});

/** Renders and waits for the first snapshot to land, as every populated case needs. */
const show = async () => {
  render(<Panel />);
  await waitFor(() => expect(getPanelSnapshot).toHaveBeenCalled());
  await screen.findByRole("button", { name: "Scan now" });
};

/** A promise a test resolves by hand, to land two reads in a chosen order. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const emit = async (event: string) => {
  await act(async () => {
    listeners.get(event)?.();
  });
};

describe("Panel", () => {
  beforeEach(() => {
    listeners.clear();
    win.hide.mockClear();
    win.onFocus = null;
    getPanelSnapshot.mockReset().mockResolvedValue({ status: "ok", data: snapshot() });
    openMain.mockReset().mockResolvedValue(undefined);
    quit.mockReset().mockResolvedValue(undefined);
    scanNow.mockReset().mockResolvedValue({ status: "ok", data: undefined });
  });

  afterEach(cleanup);

  it("leads with the grade, the verdict, the delta and when it was measured", async () => {
    await show();
    expect(screen.getByText("Needs work")).toBeInTheDocument();
    expect(screen.getByText("▲ 3 since last scan")).toBeInTheDocument();
    expect(screen.getByText("Scanned 2h ago")).toBeInTheDocument();
    expect(screen.getByText("72/100")).toBeInTheDocument();
  });

  it("lists the top three fixes with their grades", async () => {
    await show();
    expect(screen.getByRole("button", { name: "Open CLAUDE.md in acme-api — grade F, 6 issues" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open AGENTS.md in web-app — grade D, 4 issues" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Open SKILL.md in web-app — grade C, 2 issues" }),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText("Grade F")).toHaveLength(1);
  });

  it("opens the main window on a fix's detail page", async () => {
    await show();
    fireEvent.click(screen.getByRole("button", { name: "Open CLAUDE.md in acme-api — grade F, 6 issues" }));
    expect(openMain).toHaveBeenCalledWith("detail", "/code/acme-api/CLAUDE.md");
  });

  it("says there is nothing to fix rather than showing an empty list", async () => {
    getPanelSnapshot.mockResolvedValue({ status: "ok", data: snapshot({ top_fixes: [] }) });
    await show();
    expect(screen.getByText("Nothing to fix")).toBeInTheDocument();
  });

  it("counts the usage signals and routes each chip to where it is fixed", async () => {
    await show();
    fireEvent.click(screen.getByRole("button", { name: "3 never-used skills — open Setup" }));
    expect(openMain).toHaveBeenCalledWith("setup", "skill");

    fireEvent.click(screen.getByRole("button", { name: "1 MCP server erroring — open Setup" }));
    expect(openMain).toHaveBeenCalledWith("setup", "mcp_server");

    fireEvent.click(screen.getByRole("button", { name: "12 sessions today — open Analytics" }));
    expect(openMain).toHaveBeenCalledWith("analytics", null);
  });

  it("runs a scan, narrates it, and refetches when it finishes", async () => {
    await show();
    fireEvent.click(screen.getByRole("button", { name: "Scan now" }));
    expect(scanNow).toHaveBeenCalled();

    const scanning = await screen.findByRole("button", { name: "Scanning…" });
    expect(scanning).toBeDisabled();
    expect(screen.getByRole("progressbar", { name: "Scan progress" })).toBeInTheDocument();

    await emit("scan-done");
    await waitFor(() => expect(getPanelSnapshot).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("button", { name: "Scan now" })).toBeEnabled();
  });

  it("opens the app on the overview", async () => {
    await show();
    fireEvent.click(screen.getByRole("button", { name: "Open app" }));
    expect(openMain).toHaveBeenCalledWith("overview", null);
  });

  it("quits for real", async () => {
    await show();
    fireEvent.click(screen.getByRole("button", { name: "Quit" }));
    expect(quit).toHaveBeenCalled();
  });

  it("hides the window on Escape", async () => {
    await show();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(win.hide).toHaveBeenCalled();
  });

  /** The panel is re-shown with focus every time, and its numbers age fast. */
  it("refetches when the window is shown again", async () => {
    await show();
    await act(async () => {
      win.onFocus?.({ payload: true });
    });
    await waitFor(() => expect(getPanelSnapshot).toHaveBeenCalledTimes(2));
  });

  /**
   * A focus refetch and a `scan-done` refetch overlap routinely — the panel is
   * shown while a scan is finishing. Whichever query was *started* last is the
   * one whose answer is current, however the two reads happen to land.
   */
  it("keeps the newest snapshot when two refetches land out of order", async () => {
    await show();

    const older = deferred<unknown>();
    const newer = deferred<unknown>();
    getPanelSnapshot.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);

    await act(async () => {
      win.onFocus?.({ payload: true });
    });
    await act(async () => {
      win.onFocus?.({ payload: true });
    });

    await act(async () => {
      newer.resolve({ status: "ok", data: snapshot({ overall_grade: "A", overall_score: 95 }) });
    });
    await act(async () => {
      older.resolve({ status: "ok", data: snapshot({ overall_grade: "F", overall_score: 30 }) });
    });

    expect(screen.getByText("Good enough")).toBeInTheDocument();
    expect(screen.queryByText("Fix now")).not.toBeInTheDocument();
  });

  it("does not refetch when the window loses focus", async () => {
    await show();
    await act(async () => {
      win.onFocus?.({ payload: false });
    });
    expect(getPanelSnapshot).toHaveBeenCalledTimes(1);
  });

  it("offers the first scan instead of a verdict before there is data", async () => {
    getPanelSnapshot.mockResolvedValue({
      status: "ok",
      data: snapshot({ has_data: false, top_fixes: [], last_scan_at: null }),
    });
    await show();
    expect(screen.getByText("No scan yet")).toBeInTheDocument();
    expect(screen.queryByText("Needs work")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Scan now" })).toBeInTheDocument();
  });

  it("says the snapshot could not be read rather than showing a blank card", async () => {
    getPanelSnapshot.mockResolvedValue({ status: "error", error: "locked" });
    render(<Panel />);
    expect(await screen.findByText("Panel could not be read")).toBeInTheDocument();

    getPanelSnapshot.mockResolvedValue({ status: "ok", data: snapshot() });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Needs work")).toBeInTheDocument();
  });

  /** A failed refetch must not blank a panel that already has an answer on it. */
  it("keeps the last good snapshot when a refetch fails", async () => {
    await show();
    getPanelSnapshot.mockRejectedValue(new Error("locked"));
    await emit("scan-done");
    expect(screen.getByText("Needs work")).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<Panel />);
    await screen.findByRole("button", { name: "Scan now" });
    expect(await axe(container)).toHaveNoViolations();
  });
});
