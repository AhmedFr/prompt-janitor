import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { ProjectRow } from "@/lib/ipc";
import { ProjectHeader } from "./ProjectHeader";

const HOUR = 3_600_000;
const agoIso = (ms: number) => new Date(Date.now() - ms).toISOString();

const project = (o: Partial<ProjectRow> = {}): ProjectRow => ({
  id: "/code/web-app",
  name: "web-app",
  grade: "A",
  score: 94,
  file_count: 2,
  issue_count: 4,
  logo: null,
  modified: null,
  harness: "claude_code",
  session_count: 41,
  last_session_at: agoIso(3 * HOUR),
  never_used_count: 1,
  error_count: 0,
  exists: true,
  ...o,
});

afterEach(cleanup);

describe("ProjectHeader", () => {
  it("names the project and shows its path in full", () => {
    render(<ProjectHeader project={project()} lastScanAt={null} />);
    expect(screen.getByText("web-app")).toBeInTheDocument();
    expect(screen.getByTitle("/code/web-app")).toBeInTheDocument();
  });

  it("shows the grade ring with the project's score", () => {
    render(<ProjectHeader project={project()} lastScanAt={null} />);
    expect(screen.getByText("94/100")).toBeInTheDocument();
  });

  it("pairs each fact with its label", () => {
    render(<ProjectHeader project={project()} lastScanAt={agoIso(27 * HOUR)} />);
    expect(screen.getByText("Sessions").nextSibling).toHaveTextContent("41");
    expect(screen.getByText("Last session").nextSibling).toHaveTextContent("3h ago");
    expect(screen.getByText("Last scan").nextSibling).toHaveTextContent("1d ago");
  });

  it("says never rather than inventing a time for a project nothing has opened", () => {
    render(<ProjectHeader project={project({ last_session_at: null })} lastScanAt={null} />);
    expect(screen.getAllByText("never")).toHaveLength(2);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ProjectHeader project={project()} lastScanAt={agoIso(HOUR)} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
