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
      <Sidebar active="overview" onNavigate={() => {}} />,
    );

    expect(getByRole("button", { name: /web-app.*Grade A/ })).toBeInTheDocument();
    // Qualified by class: "Projects" is now both a nav destination and the
    // heading of the recents list underneath it.
    expect(getByText("Projects", { selector: ".sidebar__section-label" })).toBeInTheDocument();
  });

  it("leads with Setup and no longer lists Prompts", () => {
    const { getAllByRole } = render(<Sidebar active="setup" onNavigate={vi.fn()} />);
    const labels = getAllByRole("button").map((b) => b.textContent);
    expect(labels[0]).toBe("Setup");
    expect(labels).not.toContain("Prompts");
  });

  it("lists Projects as a destination of its own, right after Overview", () => {
    const { getAllByRole } = render(<Sidebar active="overview" onNavigate={() => {}} />);
    const labels = getAllByRole("button").map((b) => b.textContent);
    expect(labels).toContain("Projects");
    expect(labels.indexOf("Projects")).toBe(labels.indexOf("Overview") + 1);
  });

  it("routes the Projects nav item to the projects table", () => {
    const onNavigate = vi.fn();
    const { getByRole } = render(<Sidebar active="overview" onNavigate={onNavigate} />);
    getByRole("button", { name: "Projects" }).click();
    expect(onNavigate).toHaveBeenCalledWith("projects");
  });

  it("keeps Projects lit while one project's own page is open", () => {
    // `project` is not a sidebar destination of its own (see `NAV_ITEMS`), so
    // without this the whole nav goes dark the moment a project is opened.
    const { getByRole } = render(<Sidebar active="project" onNavigate={() => {}} />);
    expect(getByRole("button", { current: "page" })).toHaveTextContent("Projects");
  });

  it("keeps Setup lit while one file's detail page is open", () => {
    // `detail` is not a destination of its own either; it is opened from
    // Setup's file rows now, so Setup is the destination it belongs to.
    const { getByRole } = render(<Sidebar active="detail" onNavigate={() => {}} />);
    expect(getByRole("button", { current: "page" })).toHaveTextContent("Setup");
  });

  it("routes a recent project to its own page", () => {
    // The Projects table is the canonical list and each project has a page of
    // its own now; a recent used to land on Prompts filtered to that project.
    const onNavigate = vi.fn();
    mockSidebar.mockReturnValue({
      counts: {},
      projects: [{ id: "/web-app", name: "web-app", grade: "A", logo: null }],
    });
    const { getByRole } = render(<Sidebar active="overview" onNavigate={onNavigate} />);
    getByRole("button", { name: /web-app/ }).click();
    expect(onNavigate).toHaveBeenCalledWith("project", "/web-app");
  });

  it("has no accessibility violations", async () => {
    mockSidebar.mockReturnValue({
      counts: {},
      projects: [{ id: "/web-app", name: "web-app", grade: "A", logo: null }],
    });
    const { container } = render(
      <Sidebar active="overview" onNavigate={() => {}} onReplay={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
