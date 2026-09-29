import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, act, fireEvent, waitFor } from "@testing-library/react";
import type { NavigateEvent } from "@/lib/ipc";
import type { Navigate } from "./App.types";
import { App } from "./App";

/**
 * Every screen is stubbed: what is under test here is the router, not the
 * screens (each has its own suite). A stub publishes the props it was handed
 * and captures `navigate`, which is stable, so a test can drive a route the
 * UI has no button for yet.
 */
const nav = vi.hoisted(() => ({ current: null as Navigate | null }));
/** The live props each stub was last rendered with, callbacks included. */
const live = vi.hoisted(() => new Map<string, Record<string, unknown>>());

const makeStub = vi.hoisted(
  () =>
    (testid: string) =>
    ({ navigate, ...rest }: { navigate: Navigate } & Record<string, unknown>) => {
      nav.current = navigate;
      live.set(testid, rest);
      return <div data-testid={testid} data-props={JSON.stringify(rest)} />;
    },
);

vi.mock("@/screens/Setup", () => ({ Setup: makeStub("setup") }));
vi.mock("@/screens/Projects", () => ({ Projects: makeStub("projects") }));
vi.mock("@/screens/Settings", () => ({ Settings: makeStub("settings") }));

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, isTauri: false, commands: {} };
});

// The probe itself is covered in `useUpdateCheck.test.ts`; what the shell owes
// it is a banner that routes and dismisses.
const updateCheck = vi.hoisted(() => ({
  version: null as string | null,
  dismiss: vi.fn(),
}));
vi.mock("@/lib/useUpdateCheck", () => ({ useUpdateCheck: () => updateCheck }));

// One handler registry per test so a case can emit `navigate` like the panel does.
const listeners = vi.hoisted(() => new Map<string, (event: unknown) => void>());
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: (payload: unknown) => void) => {
    listeners.set(event, handler);
    return Promise.resolve(() => listeners.delete(event));
  }),
}));

/** The panel's `open_main` arrives here: a route and an optional target. */
const emitNavigate = async (payload: NavigateEvent) => {
  await waitFor(() => expect(listeners.has("navigate")).toBe(true));
  await act(async () => {
    listeners.get("navigate")?.({ payload });
  });
};

/** The props a stubbed screen was rendered with. */
const propsOf = (testid: string): Record<string, unknown> =>
  JSON.parse(screen.getByTestId(testid).getAttribute("data-props") ?? "{}");

const go = (route: Parameters<Navigate>[0], target?: string) =>
  act(() => nav.current?.(route, target));

describe("App", () => {
  beforeEach(() => {
    nav.current = null;
    live.clear();
    listeners.clear();
    sessionStorage.clear();
    updateCheck.version = null;
    updateCheck.dismiss.mockClear();
  });

  afterEach(cleanup);

  it("opens on Setup", () => {
    render(<App />);
    expect(screen.getByTestId("setup")).toBeInTheDocument();
  });

  it("opens Settings → Checks for the old Rules routes, on the table they named", async () => {
    render(<App />);
    go("rules", "custom");
    expect(screen.getByTestId("settings")).toBeInTheDocument();
    expect(propsOf("settings").initialTab).toBe("checks");
    expect(propsOf("settings").checksTab).toBe("custom");
  });

  it("drops a rule table that does not exist", async () => {
    render(<App />);
    go("rules-new", "nope");
    expect(propsOf("settings").initialTab).toBe("checks");
    expect(propsOf("settings").checksTab).toBeUndefined();
  });

  it("lands a panel link to an old Detail route on the file's Findings", async () => {
    render(<App />);
    await emitNavigate({ route: "detail", target: "/code/web/CLAUDE.md" });
    expect(propsOf("setup").target).toEqual({ open: { fileId: "/code/web/CLAUDE.md" }, tab: "findings" });
  });

  it("opens the project lens for an old project route", async () => {
    render(<App />);
    await emitNavigate({ route: "project", target: "/code/web" });
    expect(propsOf("setup").target).toEqual({ lens: "/code/web" });
  });

  /** An old project link with no path would otherwise carry the last lens forward. */
  it("opens the whole setup for an old project route without a path", () => {
    render(<App />);
    go("project", "/code/web-app");
    go("projects");
    go("project");
    expect(propsOf("setup").target).toEqual({});
  });

  it("opens Setup on the kind a deep link names", () => {
    render(<App />);
    go("setup", "mcp_server");
    expect(propsOf("setup").target).toEqual({ kind: "mcp_server" });
  });

  it("hands Setup every part of a deep link, parsed", () => {
    render(<App />);
    go("setup", "kind=skill&filter=never");
    expect(propsOf("setup").target).toEqual({ kind: "skill", filter: "never" });
  });

  /**
   * A plain sidebar visit to Setup names no kind, so it must clear the last
   * deep link — otherwise Setup keeps reopening on a slice the user asked for
   * once, from a screen they have since left.
   */
  it("clears the Setup target when `setup` is reached without one", () => {
    render(<App />);
    go("setup", "mcp_server");
    go("projects");
    go("setup");
    expect(propsOf("setup").target).toEqual({});
  });

  /**
   * The target arrives as a bare string from anywhere in the app; a typo or a
   * stale link would otherwise open a kind that does not exist.
   */
  it("ignores a `setup` target that names no kind", () => {
    render(<App />);
    go("setup", "not-a-kind");
    expect(propsOf("setup").target).toEqual({});
  });

  /**
   * The menu-bar panel is its own window with no router: a row clicked there
   * raises this window and sends the destination over as an event.
   */
  it("follows a `navigate` event from the panel, target and all", async () => {
    render(<App />);
    await emitNavigate({ route: "settings", target: "ai" });
    expect(propsOf("settings").initialTab).toBe("ai");
  });

  it("follows a targetless `navigate` event", async () => {
    render(<App />);
    await emitNavigate({ route: "projects", target: null });
    expect(screen.getByTestId("projects")).toBeInTheDocument();
  });

  it("lands a retired screen's link on Setup", async () => {
    render(<App />);
    go("projects");
    await emitNavigate({ route: "analytics", target: null });
    expect(screen.getByTestId("setup")).toBeInTheDocument();
  });

  /** The route crosses a window boundary as a bare string; a typo must not blank the shell. */
  it("ignores a `navigate` event naming a route that does not exist", async () => {
    render(<App />);
    await emitNavigate({ route: "not-a-route", target: null });
    expect(screen.getByTestId("setup")).toBeInTheDocument();
  });

  it("says nothing about updates while the app is current", () => {
    render(<App />);
    expect(screen.queryByText(/is available/)).not.toBeInTheDocument();
  });

  it("announces an available update above the screen area", () => {
    updateCheck.version = "0.1.1";
    render(<App />);
    expect(screen.getByText(/Prompt Janitor 0\.1\.1 is available/)).toBeInTheDocument();
    // News, not an interruption: the screen underneath stays put.
    expect(screen.getByTestId("setup")).toBeInTheDocument();
  });

  it("sends the banner's action to the Settings About tab", () => {
    updateCheck.version = "0.1.1";
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    expect(screen.getByTestId("settings")).toBeInTheDocument();
    expect(propsOf("settings").initialTab).toBe("about");
  });

  /** Acting on the news is the strongest acknowledgement of it. */
  it("dismisses the banner when its action is taken", () => {
    updateCheck.version = "0.1.1";
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    expect(updateCheck.dismiss).toHaveBeenCalledTimes(1);
  });

  it("hands the dismiss straight back to the hook that owns the session flag", () => {
    updateCheck.version = "0.1.1";
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Dismiss update notice" }));
    expect(updateCheck.dismiss).toHaveBeenCalledTimes(1);
  });

  it("stops listening for `navigate` once unmounted", async () => {
    const view = render(<App />);
    await waitFor(() => expect(listeners.has("navigate")).toBe(true));
    view.unmount();
    await waitFor(() => expect(listeners.has("navigate")).toBe(false));
  });

  describe("Back", () => {
    const setupProps = () =>
      live.get("setup") as { onTargetChange: (t: object, mode: "push" | "replace") => void; onCloseItem: () => void };
    const cmdBracket = () =>
      act(() => {
        window.dispatchEvent(new KeyboardEvent("keydown", { key: "[", metaKey: true }));
      });

    it("restores Setup's lens and filters on ⌘[, from another destination", () => {
      render(<App />);
      act(() => setupProps().onTargetChange({ lens: "/code/web", filter: "never" }, "push"));
      go("settings", "ai");
      cmdBracket();
      expect(propsOf("setup").target).toEqual({ lens: "/code/web", filter: "never" });
      cmdBracket();
      expect(propsOf("setup").target).toEqual({});
    });

    it("closes the viewer as one history step, so Back leaves Setup rather than reopening it", () => {
      render(<App />);
      go("projects");
      go("setup", "kind=skill");
      act(() => setupProps().onTargetChange({ kind: "skill", open: { artifactId: 2 }, tab: "content" }, "push"));
      act(() => setupProps().onTargetChange({ kind: "skill", open: { artifactId: 2 }, tab: "usage" }, "replace"));
      act(() => setupProps().onCloseItem());
      expect(propsOf("setup").target).toEqual({ kind: "skill" });
      cmdBracket();
      expect(screen.getByTestId("projects")).toBeInTheDocument();
    });

    it("restores the Checks sub-tab of an old Rules link", () => {
      render(<App />);
      go("rules", "custom");
      go("projects");
      cmdBracket();
      expect(propsOf("settings")).toMatchObject({ initialTab: "checks", checksTab: "custom" });
    });
  });
});
