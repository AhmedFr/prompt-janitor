import { useState } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Tabs } from "./Tabs";
import type { TabItem } from "./Tabs.types";

const ITEMS: TabItem[] = [
  { id: "rules", label: "Rules", count: 12 },
  { id: "skills", label: "Skills", count: 3 },
  { id: "agents", label: "Agents" },
];

function Controlled({ items = ITEMS, initial = "rules" }: { items?: TabItem[]; initial?: string }) {
  const [active, setActive] = useState(initial);
  return (
    <Tabs items={items} active={active} onChange={setActive} ariaLabel="Setup">
      {(id) => <p>Panel: {id}</p>}
    </Tabs>
  );
}

afterEach(cleanup);

describe("Tabs", () => {
  it("renders a labelled tablist with one tab per item", () => {
    render(<Controlled />);
    const tablist = screen.getByRole("tablist", { name: "Setup" });
    expect(tablist).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
  });

  it("marks the active tab selected and the rest not", () => {
    render(<Controlled />);
    expect(screen.getByRole("tab", { name: /Rules/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /Skills/ })).toHaveAttribute("aria-selected", "false");
    expect(screen.getByRole("tab", { name: /Agents/ })).toHaveAttribute("aria-selected", "false");
  });

  it("shows a count badge only for tabs that have one", () => {
    render(<Controlled />);
    expect(screen.getByRole("tab", { name: /Rules/ })).toHaveTextContent("12");
    expect(screen.getByRole("tab", { name: /Skills/ })).toHaveTextContent("3");
    expect(screen.getByRole("tab", { name: "Agents" })).toHaveTextContent("Agents");
  });

  it("renders the active panel's content via the render prop", () => {
    render(<Controlled />);
    expect(screen.getByText("Panel: rules")).toBeInTheDocument();
    expect(screen.queryByText("Panel: skills")).not.toBeInTheDocument();
  });

  it("connects the panel to its tab via aria-controls/aria-labelledby", () => {
    render(<Controlled />);
    const tab = screen.getByRole("tab", { name: /Rules/ });
    const panel = screen.getByRole("tabpanel");
    expect(tab).toHaveAttribute("aria-controls", panel.id);
    expect(panel).toHaveAttribute("aria-labelledby", tab.id);
  });

  it("switches tabs on click", () => {
    render(<Controlled />);
    fireEvent.click(screen.getByRole("tab", { name: /Skills/ }));
    expect(screen.getByRole("tab", { name: /Skills/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Panel: skills")).toBeInTheDocument();
  });

  it("only tabs the active tab into the sequence (roving tabindex)", () => {
    render(<Controlled />);
    expect(screen.getByRole("tab", { name: /Rules/ })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: /Skills/ })).toHaveAttribute("tabindex", "-1");
    expect(screen.getByRole("tab", { name: /Agents/ })).toHaveAttribute("tabindex", "-1");
  });

  it("moves selection right and wraps around with ArrowRight", () => {
    render(<Controlled />);
    const rules = screen.getByRole("tab", { name: /Rules/ });
    fireEvent.keyDown(rules, { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Skills/ })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(screen.getByRole("tab", { name: /Skills/ }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Agents/ })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(screen.getByRole("tab", { name: /Agents/ }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Rules/ })).toHaveAttribute("aria-selected", "true");
  });

  it("moves selection left and wraps around with ArrowLeft", () => {
    render(<Controlled />);
    const rules = screen.getByRole("tab", { name: /Rules/ });
    fireEvent.keyDown(rules, { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: /Agents/ })).toHaveAttribute("aria-selected", "true");
  });

  it("jumps to the first and last tab with Home and End", () => {
    render(<Controlled />);
    const rules = screen.getByRole("tab", { name: /Rules/ });
    fireEvent.keyDown(rules, { key: "End" });
    expect(screen.getByRole("tab", { name: /Agents/ })).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(screen.getByRole("tab", { name: /Agents/ }), { key: "Home" });
    expect(screen.getByRole("tab", { name: /Rules/ })).toHaveAttribute("aria-selected", "true");
  });

  it("focuses the newly active tab after arrow-key navigation", () => {
    render(<Controlled />);
    fireEvent.keyDown(screen.getByRole("tab", { name: /Rules/ }), { key: "ArrowRight" });
    expect(screen.getByRole("tab", { name: /Skills/ })).toHaveFocus();
  });

  it("ignores keys it doesn't handle", () => {
    render(<Controlled />);
    fireEvent.keyDown(screen.getByRole("tab", { name: /Rules/ }), { key: "a" });
    expect(screen.getByRole("tab", { name: /Rules/ })).toHaveAttribute("aria-selected", "true");
  });

  it("keeps two Tabs instances on the same page from colliding on ids", () => {
    render(
      <>
        <Tabs items={ITEMS} active="rules" onChange={vi.fn()} ariaLabel="First">
          {() => <p>first panel</p>}
        </Tabs>
        <Tabs items={ITEMS} active="rules" onChange={vi.fn()} ariaLabel="Second">
          {() => <p>second panel</p>}
        </Tabs>
      </>,
    );
    const [firstTab, secondTab] = screen.getAllByRole("tab", { name: /Rules/ });
    expect(firstTab.id).not.toBe(secondTab.id);
  });

  it("has no axe violations", async () => {
    const { container } = render(<Controlled />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
