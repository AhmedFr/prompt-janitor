import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { RankedList } from "./RankedList";
import type { RankedRow } from "./RankedList.types";

const ROWS: RankedRow[] = [
  { id: "a", label: "web-conventions", value: 24 },
  { id: "b", label: "release-checklist", value: 96 },
  { id: "c", label: "pdf-extract", value: 12 },
];

afterEach(cleanup);

describe("RankedList", () => {
  it("renders a labelled section with the given title", () => {
    render(<RankedList title="Top used" rows={ROWS} empty="Nothing yet" />);
    expect(screen.getByRole("region", { name: "Top used" })).toBeInTheDocument();
    expect(screen.getByText("Top used")).toBeInTheDocument();
  });

  it("renders rows sorted desc by value, each a list item", () => {
    render(<RankedList title="Top used" rows={ROWS} empty="Nothing yet" />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining("release-checklist"),
      expect.stringContaining("web-conventions"),
      expect.stringContaining("pdf-extract"),
    ]);
  });

  it("scales each bar's width to the max value in the ranked slice", () => {
    const { container } = render(<RankedList title="Top used" rows={ROWS} empty="Nothing yet" />);
    const bars = container.querySelectorAll(".rl__bar");
    // release-checklist (96) is the max → full width; web-conventions (24) → 25%.
    expect((bars[0] as HTMLElement).style.width).toBe("100%");
    expect((bars[1] as HTMLElement).style.width).toBe("25%");
    expect((bars[2] as HTMLElement).style.width).toBe("12.5%");
  });

  it("formats the value text with the default formatter", () => {
    render(
      <RankedList title="Top used" rows={[{ id: "a", label: "x", value: 12345 }]} empty="Nothing yet" />,
    );
    expect(screen.getByText("12,345")).toBeInTheDocument();
  });

  it("formats the value text with a caller-supplied formatter", () => {
    render(
      <RankedList
        title="Errors"
        rows={[{ id: "a", label: "x", value: 0.4 }]}
        empty="Nothing yet"
        format={(v) => `${Math.round(v * 100)}%`}
      />,
    );
    expect(screen.getByText("40%")).toBeInTheDocument();
  });

  it("shows an optional secondary value alongside the primary one", () => {
    render(
      <RankedList
        title="Errors"
        rows={[{ id: "a", label: "x", value: 0.4, secondary: "12 uses" }]}
        empty="Nothing yet"
      />,
    );
    expect(screen.getByText("12 uses")).toBeInTheDocument();
  });

  it("caps rows shown to the limit prop", () => {
    render(<RankedList title="Top used" rows={ROWS} empty="Nothing yet" limit={2} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("defaults the limit to 10", () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ id: String(i), label: `r${i}`, value: i }));
    render(<RankedList title="Top used" rows={many} empty="Nothing yet" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(10);
  });

  it("renders a plain row for a row without onClick", () => {
    render(<RankedList title="Top used" rows={ROWS} empty="Nothing yet" />);
    const body = screen.getByRole("list");
    expect(within(body).queryAllByRole("button")).toHaveLength(0);
  });

  it("renders a row as a button when onClick is set, and fires it", () => {
    const onClick = vi.fn();
    render(
      <RankedList
        title="Top used"
        rows={[{ id: "a", label: "clickable", value: 5, onClick }]}
        empty="Nothing yet"
      />,
    );
    const button = screen.getByRole("button", { name: /clickable/ });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders a selector's options and marks the active one pressed", () => {
    const onChange = vi.fn();
    render(
      <RankedList
        title="Top used"
        rows={ROWS}
        empty="Nothing yet"
        selector={{
          options: [
            { id: "skills", label: "Skills" },
            { id: "agents", label: "Agents" },
          ],
          active: "skills",
          onChange,
        }}
      />,
    );
    expect(screen.getByRole("button", { name: "Skills" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Agents" })).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByRole("button", { name: "Agents" }));
    expect(onChange).toHaveBeenCalledWith("agents");
  });

  it("renders a details button that fires its onClick", () => {
    const onClick = vi.fn();
    render(
      <RankedList
        title="Top used"
        rows={ROWS}
        empty="Nothing yet"
        details={{ label: "See all in Setup", onClick }}
      />,
    );
    const link = screen.getByRole("button", { name: "See all in Setup" });
    expect(link).toHaveClass("rl__details");
    fireEvent.click(link);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows the empty copy and no list when there are no rows", () => {
    render(<RankedList title="Top used" rows={[]} empty="Nothing scanned yet" />);
    expect(screen.getByText("Nothing scanned yet")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("swaps the bar tint under variant=error", () => {
    const { container } = render(
      <RankedList title="Most errors" rows={ROWS} empty="Nothing yet" variant="error" />,
    );
    expect(container.querySelector(".rl__list")).toHaveAttribute("data-variant", "error");
  });

  it("defaults to the default variant", () => {
    const { container } = render(<RankedList title="Top used" rows={ROWS} empty="Nothing yet" />);
    expect(container.querySelector(".rl__list")).toHaveAttribute("data-variant", "default");
  });

  it("renders an optional glyph", () => {
    render(
      <RankedList
        title="Top used"
        rows={[{ id: "a", label: "x", value: 1, glyph: <span data-testid="g">*</span> }]}
        empty="Nothing yet"
      />,
    );
    expect(screen.getByTestId("g")).toBeInTheDocument();
  });

  it("has no axe violations", async () => {
    const { container } = render(
      <RankedList
        title="Top used"
        rows={ROWS}
        empty="Nothing yet"
        selector={{
          options: [{ id: "skills", label: "Skills" }],
          active: "skills",
          onChange: vi.fn(),
        }}
        details={{ label: "See all", onClick: vi.fn() }}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no axe violations with clickable rows", async () => {
    const { container } = render(
      <RankedList
        title="Top used"
        rows={[{ id: "a", label: "clickable", value: 5, onClick: vi.fn() }]}
        empty="Nothing yet"
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no axe violations when empty", async () => {
    const { container } = render(<RankedList title="Top used" rows={[]} empty="Nothing yet" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
