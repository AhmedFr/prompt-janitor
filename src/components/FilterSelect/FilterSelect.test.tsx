import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import { FilterSelect } from "./FilterSelect";
import type { FilterSelectOption, FilterSelectProps } from "./FilterSelect.types";
import { CLEAR_LABEL, FILTER_PLACEHOLDER, NO_MATCH_LABEL, SEARCH_THRESHOLD } from "./FilterSelect.constants";

afterEach(cleanup);

const OPTIONS: FilterSelectOption[] = [
  { id: "global", label: "Global", count: 41 },
  { id: "orca", label: "orca", count: 8 },
  { id: "prompt-janitor", label: "prompt-janitor", count: 12 },
];

/** Enough options to cross {@link SEARCH_THRESHOLD}. */
const MANY: FilterSelectOption[] = Array.from({ length: SEARCH_THRESHOLD + 1 }, (_, i) => ({
  id: `p${i}`,
  label: i === 0 ? "Global" : `project-${i}`,
  count: i,
}));

function setup(overrides: Partial<FilterSelectProps> = {}) {
  const onToggle = vi.fn();
  const onClear = vi.fn();
  const props: FilterSelectProps = {
    label: "Scope",
    options: OPTIONS,
    selected: [],
    multi: true,
    onToggle,
    onClear,
    ...overrides,
  };
  return { ...render(<FilterSelect {...props} />), onToggle, onClear, props };
}

/** The trigger, whatever its current accessible name. */
const trigger = () => screen.getByRole("button", { name: /^Scope/ });

function open() {
  fireEvent.click(trigger());
  return screen.getByRole("listbox");
}

/** The bottom of the open list — where End lands and ArrowDown stops. */
function lastOption(): HTMLElement {
  const options = screen.getAllByRole("option");
  return options[options.length - 1];
}

describe("FilterSelect: trigger", () => {
  it("names the group and stays closed until it is pressed", () => {
    setup();
    expect(trigger()).toHaveAccessibleName("Scope");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("names its one selection rather than counting it", () => {
    setup({ selected: ["global"] });
    expect(trigger()).toHaveAccessibleName("Scope, Global");
    expect(trigger()).toHaveTextContent("Scope · Global");
  });

  it("counts past one selection instead of listing them", () => {
    setup({ selected: ["global", "orca"] });
    expect(trigger()).toHaveAccessibleName("Scope, 2 selected");
    expect(trigger()).toHaveTextContent("Scope · 2");
  });

  it("ignores a selected id the options no longer offer", () => {
    setup({ selected: ["gone"] });
    expect(trigger()).toHaveAccessibleName("Scope");
  });

  it("marks itself active only while something is selected", () => {
    const { rerender, props } = setup();
    expect(trigger()).toHaveAttribute("data-active", "false");
    rerender(<FilterSelect {...props} selected={["orca"]} />);
    expect(trigger()).toHaveAttribute("data-active", "true");
  });
});

describe("FilterSelect: popover", () => {
  it("lists every option with its faceted count", () => {
    setup();
    const list = open();
    const options = within(list).getAllByRole("option");
    expect(options.map((el) => el.textContent)).toEqual(["Global41", "orca8", "prompt-janitor12"]);
  });

  it("names an option by its label and its count, not by the two run together", () => {
    setup();
    open();
    expect(screen.getByRole("option", { name: "Global, 41" })).toBeInTheDocument();
  });

  it("marks the selected options and multi-selectability for assistive tech", () => {
    setup({ selected: ["orca"] });
    const list = open();
    expect(list).toHaveAttribute("aria-multiselectable", "true");
    expect(screen.getByRole("option", { name: /^orca/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: /^Global/ })).toHaveAttribute("aria-selected", "false");
  });

  it("does not claim multi-selectability for a single-select group", () => {
    setup({ multi: false });
    expect(open()).not.toHaveAttribute("aria-multiselectable", "true");
  });

  it("toggles an option and stays open for a multi group", () => {
    const { onToggle } = setup();
    open();
    fireEvent.click(screen.getByRole("option", { name: /^orca/ }));
    expect(onToggle).toHaveBeenCalledWith("orca");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("closes after a pick in a single-select group", () => {
    const { onToggle } = setup({ multi: false });
    open();
    fireEvent.click(screen.getByRole("option", { name: /^orca/ }));
    expect(onToggle).toHaveBeenCalledWith("orca");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("keeps Clear out of an untouched group", () => {
    setup();
    open();
    expect(screen.queryByRole("button", { name: CLEAR_LABEL })).not.toBeInTheDocument();
  });

  it("offers Clear once something is selected", () => {
    setup({ selected: ["orca"] });
    open();
    expect(screen.getByRole("button", { name: CLEAR_LABEL })).toBeInTheDocument();
  });

  it("clears the group and closes", () => {
    const { onClear } = setup({ selected: ["orca", "global"] });
    open();
    fireEvent.click(screen.getByRole("button", { name: CLEAR_LABEL }));
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("FilterSelect: option search", () => {
  it("stays out of the way of a short list", () => {
    setup();
    open();
    expect(screen.queryByPlaceholderText(FILTER_PLACEHOLDER)).not.toBeInTheDocument();
  });

  it("appears once the list is long enough to need it", () => {
    setup({ options: MANY });
    open();
    expect(screen.getByPlaceholderText(FILTER_PLACEHOLDER)).toBeInTheDocument();
  });

  it("narrows the list case-insensitively", () => {
    setup({ options: MANY });
    open();
    fireEvent.change(screen.getByPlaceholderText(FILTER_PLACEHOLDER), { target: { value: "GLOB" } });
    expect(screen.getAllByRole("option").map((el) => el.textContent)).toEqual(["Global0"]);
  });

  it("says so when a query matches nothing", () => {
    setup({ options: MANY });
    open();
    fireEvent.change(screen.getByPlaceholderText(FILTER_PLACEHOLDER), { target: { value: "zzz" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText(NO_MATCH_LABEL)).toBeInTheDocument();
  });

  it("forgets the query between openings", () => {
    setup({ options: MANY });
    open();
    fireEvent.change(screen.getByPlaceholderText(FILTER_PLACEHOLDER), { target: { value: "zzz" } });
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    open();
    expect(screen.getByPlaceholderText(FILTER_PLACEHOLDER)).toHaveValue("");
    expect(screen.getAllByRole("option")).toHaveLength(MANY.length);
  });
});

describe("FilterSelect: keyboard", () => {
  it("opens on ArrowDown with the first option active", () => {
    setup();
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    const list = screen.getByRole("listbox");
    const first = within(list).getAllByRole("option")[0];
    expect(trigger()).toHaveAttribute("aria-activedescendant", first.id);
  });

  it("walks the options and toggles the active one on Enter", () => {
    const { onToggle } = setup();
    open();
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    fireEvent.keyDown(trigger(), { key: "Enter" });
    expect(onToggle).toHaveBeenCalledWith("orca");
  });

  it("stops at the ends rather than wrapping", () => {
    setup();
    open();
    for (let i = 0; i < 10; i++) fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    expect(trigger()).toHaveAttribute("aria-activedescendant", lastOption().id);
    for (let i = 0; i < 10; i++) fireEvent.keyDown(trigger(), { key: "ArrowUp" });
    expect(trigger()).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[0].id);
  });

  it("jumps to the ends with Home and End", () => {
    setup();
    open();
    fireEvent.keyDown(trigger(), { key: "End" });
    expect(trigger()).toHaveAttribute("aria-activedescendant", lastOption().id);
    fireEvent.keyDown(trigger(), { key: "Home" });
    expect(trigger()).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[0].id);
  });

  it("closes on Escape and hands focus back to the trigger", () => {
    setup();
    open();
    fireEvent.keyDown(trigger(), { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(trigger()).toHaveFocus();
  });

  it("closes on Tab without swallowing the tab", () => {
    setup();
    open();
    fireEvent.keyDown(trigger(), { key: "Tab" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("moves the caret into the option search when there is one", () => {
    setup({ options: MANY });
    open();
    expect(screen.getByPlaceholderText(FILTER_PLACEHOLDER)).toHaveFocus();
  });

  it("drives the list from the search box", () => {
    const { onToggle } = setup({ options: MANY });
    open();
    const input = screen.getByPlaceholderText(FILTER_PLACEHOLDER);
    fireEvent.change(input, { target: { value: "project-2" } });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onToggle).toHaveBeenCalledWith("p2");
  });
});

describe("FilterSelect: dismissal", () => {
  it("closes on a click outside", () => {
    render(<button type="button">Elsewhere</button>);
    setup();
    open();
    fireEvent.mouseDown(screen.getByRole("button", { name: "Elsewhere" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("stays open when the click lands inside it", () => {
    setup();
    const list = open();
    fireEvent.mouseDown(list);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("closes when the trigger is pressed again", () => {
    setup();
    open();
    fireEvent.click(trigger());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("FilterSelect: accessibility", () => {
  it("has no axe violations closed", async () => {
    const { container } = setup({ selected: ["orca"] });
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no axe violations open", async () => {
    const { container } = setup({ selected: ["orca"], options: MANY });
    open();
    expect(await axe(container)).toHaveNoViolations();
  });
});
