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
      <Sidebar active="rules" onNavigate={() => {}} onReplay={() => {}} />,
    );
    // The Rules nav item should be the one flagged as the current page.
    expect(getByRole("button", { current: "page" })).toHaveTextContent("Rules");
  });

  it("shows badge counts and the recent-projects list when data is present", () => {
    mockSidebar.mockReturnValue({
      counts: { prompts: 42, rules: 27 },
      projects: [
        { id: "/web-app", name: "web-app", grade: "A", logo: null, modified: "200" },
        { id: "/scripts", name: "scripts", grade: "F", logo: null, modified: "100" },
      ],
    });
    const { getByRole, getByText } = render(
      <Sidebar active="overview" onNavigate={() => {}} />,
    );

    expect(getByRole("button", { name: /Prompts.*42/ })).toBeInTheDocument();
    expect(getByRole("button", { name: /Rules.*27/ })).toBeInTheDocument();
    expect(getByRole("button", { name: /web-app.*Grade A/ })).toBeInTheDocument();
    // Qualified by class: "Projects" is now both a nav destination and the
    // heading of the recents list underneath it.
    expect(getByText("Projects", { selector: ".sidebar__section-label" })).toBeInTheDocument();
  });

  it("lists Projects as a destination of its own, right after Setup", () => {
    const { getAllByRole } = render(<Sidebar active="overview" onNavigate={() => {}} />);
    const labels = getAllByRole("button").map((b) => b.textContent);
    expect(labels).toContain("Projects");
    expect(labels.indexOf("Projects")).toBe(labels.indexOf("Setup") + 1);
  });

  it("routes the Projects nav item to the projects table", () => {
    const onNavigate = vi.fn();
    const { getByRole } = render(<Sidebar active="overview" onNavigate={onNavigate} />);
    getByRole("button", { name: "Projects" }).click();
    expect(onNavigate).toHaveBeenCalledWith("projects");
  });

  it("routes a project click to Prompts with the project id", () => {
    const onNavigate = vi.fn();
    mockSidebar.mockReturnValue({
      counts: {},
      projects: [{ id: "/web-app", name: "web-app", grade: "A", logo: null, modified: "200" }],
    });
    const { getByRole } = render(<Sidebar active="overview" onNavigate={onNavigate} />);
    getByRole("button", { name: /web-app/ }).click();
    expect(onNavigate).toHaveBeenCalledWith("prompts", "/web-app");
  });

  it("has no accessibility violations", async () => {
    mockSidebar.mockReturnValue({
      counts: { prompts: 42, rules: 27 },
      projects: [{ id: "/web-app", name: "web-app", grade: "A", logo: null, modified: "200" }],
    });
    const { container } = render(
      <Sidebar active="overview" onNavigate={() => {}} onReplay={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
