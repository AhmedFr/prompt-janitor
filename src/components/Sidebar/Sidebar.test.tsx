import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Sidebar } from "./Sidebar";
import type { SidebarProject, NavCounts } from "./Sidebar.types";

// The hook talks to Tauri; drive the render paths by faking its output.
const mockSidebar = vi.fn<() => { projects: SidebarProject[]; counts: NavCounts }>(() => ({
  projects: [],
  counts: {},
}));
vi.mock("./useSidebar", () => ({ useSidebar: () => mockSidebar() }));

describe("Sidebar", () => {
  beforeEach(() => {
    mockSidebar.mockReturnValue({ projects: [], counts: {} });
  });

  afterEach(cleanup);

  it("marks the active route with aria-current", () => {
    const { getByRole } = render(
      <Sidebar active="settings" onNavigate={() => {}} onReplay={() => {}} />,
    );
    // The Settings nav item should be the one flagged as the current page.
    expect(getByRole("button", { current: "page" })).toHaveTextContent("Settings");
  });

  it("shows the recent-projects list when data is present", () => {
    mockSidebar.mockReturnValue({
      counts: {},
      projects: [
        { id: "/web-app", name: "web-app", grade: "A", logo: null },
        { id: "/scripts", name: "scripts", grade: "F", logo: null },
      ],
    });
    const { getByRole, getByText } = render(
      <Sidebar active="setup" onNavigate={() => {}} />,
    );

    expect(getByRole("button", { name: /web-app.*Grade A/ })).toBeInTheDocument();
    expect(getByText("Recent", { selector: ".sidebar__section-label" })).toBeInTheDocument();
  });

  it("lists exactly Setup, Projects, Settings (spec §3.1)", () => {
    const { getAllByRole } = render(<Sidebar active="setup" onNavigate={vi.fn()} />);
    const labels = getAllByRole("button").map((b) => b.textContent);
    expect(labels.slice(0, 3)).toEqual(["Setup", "Projects", "Settings"]);
    for (const gone of ["Overview", "Prompts", "Scans", "Analytics", "Rules"]) expect(labels).not.toContain(gone);
  });

  it.each([
    ["setup", "Setup"],
    ["projects", "Projects"],
    ["settings", "Settings"],
  ] as const)("lights %s, the destination it is on", (route, label) => {
    const { getByRole } = render(<Sidebar active={route} onNavigate={() => {}} />);
    expect(getByRole("button", { current: "page" })).toHaveTextContent(label);
  });

  it("routes the Projects nav item to the projects table", () => {
    const onNavigate = vi.fn();
    const { getByRole } = render(<Sidebar active="setup" onNavigate={onNavigate} />);
    getByRole("button", { name: "Projects" }).click();
    expect(onNavigate).toHaveBeenCalledWith("projects");
  });

  it("opens a recent project as a lens on Setup", () => {
    const onNavigate = vi.fn();
    mockSidebar.mockReturnValue({
      counts: {},
      projects: [{ id: "/code/web", name: "web", grade: "B", logo: null }],
    });
    const { getByRole } = render(<Sidebar active="setup" onNavigate={onNavigate} />);
    getByRole("button", { name: /web/ }).click();
    expect(onNavigate).toHaveBeenCalledWith("setup", "lens=%2Fcode%2Fweb");
  });

  it("has no accessibility violations", async () => {
    mockSidebar.mockReturnValue({
      counts: {},
      projects: [{ id: "/web-app", name: "web-app", grade: "A", logo: null }],
    });
    const { container } = render(
      <Sidebar active="setup" onNavigate={() => {}} onReplay={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
