import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { RuleInfo } from "@/lib/ipc";
import { RulePanel } from "./index";

afterEach(cleanup);

const rule = (over: Partial<RuleInfo> = {}): RuleInfo => ({
  id: "no-slack",
  title: "No Slack",
  description: "Flags any file that mentions Slack.",
  source: "custom",
  severity: "mid",
  enabled: true,
  custom: true,
  nl: false,
  pattern: "slack.com",
  hit_count: 3,
  ...over,
});

const terms = (container: HTMLElement) => [...container.querySelectorAll("dt")].map((dt) => dt.textContent);

describe("RulePanel", () => {
  it("is a sheet named after the rule", () => {
    render(<RulePanel rule={rule()} onClose={() => {}} />);
    expect(screen.getByRole("dialog")).toHaveAccessibleName("No Slack — rule");
    expect(screen.getByRole("heading", { name: "No Slack" })).toBeInTheDocument();
  });

  it("shows the full description the table no longer draws", () => {
    render(<RulePanel rule={rule()} onClose={() => {}} />);
    expect(screen.getByText("Flags any file that mentions Slack.")).toBeInTheDocument();
  });

  it("lists what the rule is", () => {
    const { container } = render(<RulePanel rule={rule()} onClose={() => {}} />);
    expect(terms(container)).toEqual(["Source", "Severity", "Status", "Type", "Open issues"]);
    expect(screen.getByText("Warning")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("Pattern rule")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows a pattern rule's forbidden substring verbatim", () => {
    const { container } = render(<RulePanel rule={rule()} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Pattern" })).toBeInTheDocument();
    expect(container.querySelector("pre")).toHaveTextContent("slack.com");
  });

  it("calls an AI standard's text its instruction", () => {
    render(<RulePanel rule={rule({ nl: true, pattern: "State the output shape." })} onClose={() => {}} />);
    expect(screen.getByRole("heading", { name: "Instruction" })).toBeInTheDocument();
    expect(screen.getByText("AI standard")).toBeInTheDocument();
  });

  it("says a built-in rule with no pattern is built in, and draws no empty block", () => {
    const { container } = render(
      <RulePanel rule={rule({ custom: false, source: "anthropic", pattern: null, enabled: false })} onClose={() => {}} />,
    );
    expect(screen.getByText("Built-in")).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
    expect(container.querySelector("pre")).toBeNull();
  });

  it("skips the description block when the rule has none", () => {
    render(<RulePanel rule={rule({ description: "" })} onClose={() => {}} />);
    expect(screen.queryByRole("heading", { name: "Description" })).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(<RulePanel rule={rule()} onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<RulePanel rule={rule()} onClose={() => {}} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
