import { useState } from "react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Tabs } from "./Tabs";
import { useTabState } from "./useTabState";
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

/** A screen wiring `useTabState` into `Tabs`, the way memory is meant to be used. */
function StatefulControlled({
  items = ITEMS,
  storageKey = "test-tabs",
}: {
  items?: TabItem[];
  storageKey?: string;
}) {
  const [active, setActive] = useTabState(
    storageKey,
    items[0].id,
    items.map((item) => item.id),
  );
  return (
    <Tabs items={items} active={active} onChange={setActive} ariaLabel="Setup">
      {(id) => <p>Panel: {id}</p>}
    </Tabs>
  );
}

beforeEach(() => {
  window.sessionStorage.clear();
});
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

  it("renders a countLabel badge verbatim, for counts a single number can't say", () => {
    const items: TabItem[] = [
      { id: "builtin", label: "Built-in", countLabel: "12/20" },
      { id: "custom", label: "Custom", countLabel: "0/0" },
    ];
    render(<Controlled items={items} initial="builtin" />);
    expect(screen.getByRole("tab", { name: /Built-in/ })).toHaveTextContent("12/20");
    expect(screen.getByRole("tab", { name: /Custom/ })).toHaveTextContent("0/0");
  });

  it("prefers countLabel over count when a tab carries both", () => {
    const items: TabItem[] = [{ id: "builtin", label: "Built-in", count: 20, countLabel: "12/20" }];
    render(<Controlled items={items} initial="builtin" />);
    const tab = screen.getByRole("tab", { name: /Built-in/ });
    expect(tab).toHaveTextContent("12/20");
    expect(tab).not.toHaveTextContent("Built-in20");
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

  it("treats an unknown active id as the first tab and asks the parent to correct it", () => {
    const onChange = vi.fn();
    render(
      <Tabs items={ITEMS} active="does-not-exist" onChange={onChange} ariaLabel="Setup">
        {(id) => <p>Panel: {id}</p>}
      </Tabs>,
    );

    const rules = screen.getByRole("tab", { name: /Rules/ });
    expect(rules).toHaveAttribute("aria-selected", "true");
    expect(rules).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: /Skills/ })).toHaveAttribute("aria-selected", "false");

    const panel = screen.getByRole("tabpanel");
    expect(panel).toHaveAttribute("aria-labelledby", rules.id);
    expect(rules).toHaveAttribute("aria-controls", panel.id);
    expect(screen.getByText("Panel: rules")).toBeInTheDocument();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("rules");
  });

  it("stops correcting once the parent adopts the first tab as active", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Tabs items={ITEMS} active="does-not-exist" onChange={onChange} ariaLabel="Setup">
        {(id) => <p>Panel: {id}</p>}
      </Tabs>,
    );
    expect(onChange).toHaveBeenCalledTimes(1);

    rerender(
      <Tabs items={ITEMS} active="rules" onChange={onChange} ariaLabel="Setup">
        {(id) => <p>Panel: {id}</p>}
      </Tabs>,
    );
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("recovers to the first tab, selected and tabbable, when sessionStorage holds a stale id", () => {
    window.sessionStorage.setItem("pj.tabs.test-tabs", "removed-tab");
    render(<StatefulControlled />);

    const rules = screen.getByRole("tab", { name: /Rules/ });
    expect(rules).toHaveAttribute("aria-selected", "true");
    expect(rules).toHaveAttribute("tabindex", "0");
    expect(screen.getByText("Panel: rules")).toBeInTheDocument();
  });
  it("leaves the panel out of the tab sequence — its content is what you tab to", () => {
    render(<Controlled />);
    // A panel whose content is focusable (a table's rows, its search box) must
    // not also be a tab stop of its own.
    expect(screen.getByRole("tabpanel")).not.toHaveAttribute("tabindex");
  });

  it("renders no panel at all when there are no tabs", () => {
    const { container } = render(
      <Tabs items={[]} active="" onChange={vi.fn()} ariaLabel="Setup">
        {(id) => <p>Panel: {id}</p>}
      </Tabs>,
    );
    // An empty strip has no tab to point `aria-labelledby` at, and a panel
    // labelled by nothing is worse than no panel.
    expect(screen.queryByRole("tabpanel")).not.toBeInTheDocument();
    expect(container.querySelector(".tabs__panel")).toBeNull();
    expect(screen.getByRole("tablist", { name: "Setup" })).toBeInTheDocument();
  });

  it("has no axe violations with no tabs", async () => {
    const { container } = render(
      <Tabs items={[]} active="" onChange={vi.fn()} ariaLabel="Setup">
        {(id) => <p>Panel: {id}</p>}
      </Tabs>,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("asks the parent to correct a stale tab once, not once per re-render", () => {
    const onChange = vi.fn();
    const render_ = (key: number) => (
      // A fresh array each render, the way a parent that maps its data does.
      <Tabs items={[...ITEMS]} active="does-not-exist" onChange={onChange} ariaLabel={`Setup ${key}`}>
        {(id) => <p>Panel: {id}</p>}
      </Tabs>
    );
    const { rerender } = render(render_(1));
    rerender(render_(2));
    rerender(render_(3));

    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
