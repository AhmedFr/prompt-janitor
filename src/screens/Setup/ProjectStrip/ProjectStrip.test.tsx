import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { ProjectStrip } from "./ProjectStrip";

afterEach(cleanup);

const project = { harness: "claude_code", path: "/code/web", name: "web", exists: true, session_count: 148,
  last_session_at: "2026-09-26T10:00:00Z", artifacts: [] };

describe("ProjectStrip", () => {
  it("names the project, its sessions and offers Reveal in Finder", () => {
    const onReveal = vi.fn();
    render(<ProjectStrip project={project} sessionsPerDay={[{ day: "2026-09-25", count: 2 }, { day: "2026-09-26", count: 5 }]} onReveal={onReveal} />);
    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByText("7 sessions · 90 days")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    expect(onReveal).toHaveBeenCalled();
  });

  it("says the folder is missing instead of drawing a chart", () => {
    render(<ProjectStrip project={{ ...project, exists: false }} sessionsPerDay={null} onReveal={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent(/folder/i);
    expect(screen.queryByRole("button", { name: "Reveal in Finder" })).toBeNull();
  });

  it("says No sessions yet when there is no session data, and still offers Reveal", () => {
    render(<ProjectStrip project={{ ...project, session_count: 0, last_session_at: null }} sessionsPerDay={null} onReveal={vi.fn()} />);
    expect(screen.getByText("No sessions yet")).toBeInTheDocument();
    expect(screen.queryByText(/sessions · 90 days/)).toBeNull();
    expect(screen.getByRole("button", { name: "Reveal in Finder" })).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<ProjectStrip project={project} sessionsPerDay={[{ day: "2026-09-26", count: 5 }]} onReveal={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
