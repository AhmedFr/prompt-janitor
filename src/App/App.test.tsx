import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, act } from "@testing-library/react";
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

/** The props a stubbed screen was rendered with. */
const propsOf = (testid: string): Record<string, unknown> =>
  JSON.parse(screen.getByTestId(testid).getAttribute("data-props") ?? "{}");

const go = (route: Parameters<Navigate>[0], target?: string) =>
  act(() => nav.current?.(route, target));

describe("App", () => {
  beforeEach(() => {
    nav.current = null;
    sessionStorage.clear();
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

  it("keeps the file id when `detail` is reached without one", () => {
    render(<App />);
    go("detail", "/code/web-app/CLAUDE.md");
    go("overview");
    go("detail");
    expect(propsOf("detail").fileId).toBe("/code/web-app/CLAUDE.md");
  });
});
