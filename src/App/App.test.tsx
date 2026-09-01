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

const makeStub = vi.hoisted(
  () =>
    (testid: string) =>
    ({ navigate, ...rest }: { navigate: Navigate } & Record<string, unknown>) => {
      nav.current = navigate;
      return <div data-testid={testid} data-props={JSON.stringify(rest)} />;
    },
);

vi.mock("@/screens/Overview", () => ({ Overview: makeStub("overview") }));
vi.mock("@/screens/Setup", () => ({ Setup: makeStub("setup") }));
vi.mock("@/screens/Projects", () => ({ Projects: makeStub("projects") }));
vi.mock("@/screens/Project", () => ({ Project: makeStub("project") }));
vi.mock("@/screens/Prompts", () => ({ Prompts: makeStub("prompts") }));
vi.mock("@/screens/Detail", () => ({ Detail: makeStub("detail") }));
vi.mock("@/screens/Scans", () => ({ Scans: makeStub("scans") }));
vi.mock("@/screens/Analytics", () => ({ Analytics: makeStub("analytics") }));
vi.mock("@/screens/Rules", () => ({ Rules: makeStub("rules") }));
vi.mock("@/screens/RulesNew", () => ({ RulesNew: makeStub("rules-new") }));
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
    listeners.clear();
    sessionStorage.clear();
    updateCheck.version = null;
    updateCheck.dismiss.mockClear();
  });

  afterEach(cleanup);

  it("starts on the overview", () => {
    render(<App />);
    expect(screen.getByTestId("overview")).toBeInTheDocument();
  });

  it("routes to the add-rule flow with the tab the user came from", () => {
    render(<App />);
    go("rules-new", "ai");
    expect(screen.getByTestId("rules-new")).toBeInTheDocument();
    expect(propsOf("rules-new").initialType).toBe("ai");
    expect(screen.queryByTestId("rules")).not.toBeInTheDocument();
  });

  it("sends the new rule's tab back to the Rules screen", () => {
    render(<App />);
    go("rules", "custom");
    expect(propsOf("rules").initialTab).toBe("custom");
  });

  /**
   * Unlike `detail`, an untargeted `project` clears rather than keeps: the
   * screen is addressed by path, and carrying the last one forward would
   * silently open the wrong project.
   */
  it("clears the project path when `project` is reached without one", () => {
    render(<App />);
    go("project", "/code/web-app");
    expect(propsOf("project").path).toBe("/code/web-app");

    go("overview");
    go("project");
    expect(propsOf("project").path).toBeUndefined();
  });

  it("opens Setup on the kind a deep link names", () => {
    render(<App />);
    go("setup", "mcp_server");
    expect(propsOf("setup").initialTab).toBe("mcp_server");
  });

  /**
   * A plain sidebar visit to Setup names no kind, so it must clear the last
   * deep link's tab — otherwise the strip keeps reopening on a kind the user
   * asked for once, from a screen they have since left.
   */
  it("clears the Setup tab when `setup` is reached without one", () => {
    render(<App />);
    go("setup", "mcp_server");
    go("overview");
    go("setup");
    expect(propsOf("setup").initialTab).toBeUndefined();
  });

  /**
   * The target arrives as a bare string from anywhere in the app; a typo or a
   * stale link would otherwise be stored as a kind tab that does not exist.
   */
  it("ignores a `setup` target that names no kind tab", () => {
    render(<App />);
    go("setup", "not-a-kind");
    expect(propsOf("setup").initialTab).toBeUndefined();
  });

  it("keeps the file id when `detail` is reached without one", () => {
    render(<App />);
    go("detail", "/code/web-app/CLAUDE.md");
    go("overview");
    go("detail");
    expect(propsOf("detail").fileId).toBe("/code/web-app/CLAUDE.md");
  });

  /**
   * The menu-bar panel is its own window with no router: a row clicked there
   * raises this window and sends the destination over as an event.
   */
  it("follows a `navigate` event from the panel, target and all", async () => {
    render(<App />);
    await emitNavigate({ route: "detail", target: "/code/acme-api/CLAUDE.md" });
    expect(screen.getByTestId("detail")).toBeInTheDocument();
    expect(propsOf("detail").fileId).toBe("/code/acme-api/CLAUDE.md");
  });

  it("follows a targetless `navigate` event", async () => {
    render(<App />);
    await emitNavigate({ route: "analytics", target: null });
    expect(screen.getByTestId("analytics")).toBeInTheDocument();
  });

  /** The route crosses a window boundary as a bare string; a typo must not blank the shell. */
  it("ignores a `navigate` event naming a route that does not exist", async () => {
    render(<App />);
    await emitNavigate({ route: "not-a-route", target: null });
    expect(screen.getByTestId("overview")).toBeInTheDocument();
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
    expect(screen.getByTestId("overview")).toBeInTheDocument();
  });

  it("sends the banner's action to the Settings App tab", () => {
    updateCheck.version = "0.1.1";
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open Settings" }));
    expect(screen.getByTestId("settings")).toBeInTheDocument();
    expect(propsOf("settings").initialTab).toBe("app");
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
});
