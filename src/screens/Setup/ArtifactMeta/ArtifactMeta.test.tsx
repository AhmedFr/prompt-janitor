import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { ArtifactView } from "@/lib/ipc";
import { ArtifactMeta } from "./index";

afterEach(cleanup);

const mcp: ArtifactView = {
  id: 1,
  harness: "claude_code",
  layer: "global",
  kind: "mcp_server",
  name: "posthog",
  path: "/Users/a/.claude.json",
  plugin_name: null,
  description: "Product analytics, feature flags and session replay",
  bytes: 10,
  grade: null,
  score: null,
  file_id: null,
  usage: {
    total: 312,
    sessions: 18,
    last_used: null,
    error_rate: 0.31,
    avg_turn_tokens: 7300,
    count_30d: 0,
    count_prev_30d: 0,
  },
};

describe("ArtifactMeta", () => {
  it("says what it is on one line", () => {
    const { container } = render(<ArtifactMeta artifact={mcp} scope="Global" />);
    expect(container.querySelector(".am__line")?.textContent).toContain("MCP server·Global·312 uses·31% errors");
  });

  it("marks a bad error rate with a word and an icon, not colour alone", () => {
    render(<ArtifactMeta artifact={mcp} scope="Global" />);
    const rate = screen.getByText("31% errors");
    expect(rate.closest("[data-tone]")).toHaveAttribute("data-tone", "bad");
    expect(rate.closest("[data-tone]")?.querySelector("svg")).not.toBeNull();
  });

  it("shows the description under the line", () => {
    render(<ArtifactMeta artifact={mcp} scope="Global" />);
    expect(screen.getByText("Product analytics, feature flags and session replay")).toBeInTheDocument();
  });

  it("leaves the description to the file when asked", () => {
    render(<ArtifactMeta artifact={mcp} scope="Global" showDescription={false} />);
    expect(screen.queryByText("Product analytics, feature flags and session replay")).toBeNull();
  });

  it("keeps the full facts behind Details", () => {
    render(<ArtifactMeta artifact={mcp} scope="Global" />);
    const toggle = screen.getByRole("button", { name: "Details" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Avg tokens per turn")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Avg tokens per turn")).toBeInTheDocument();
    expect(screen.getByText("312 in 18 sessions")).toBeInTheDocument();
  });

  it("has no accessibility violations, closed or open", async () => {
    const { container } = render(<ArtifactMeta artifact={mcp} scope="Global" />);
    expect(await axe(container)).toHaveNoViolations();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(await axe(container)).toHaveNoViolations();
  });
});
