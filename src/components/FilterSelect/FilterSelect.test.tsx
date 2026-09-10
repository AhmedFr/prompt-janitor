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

/**
 * The trigger, whatever its current accessible name — and whatever its role,
 * which depends on whether the group is big enough to grow a filter box.
 */
// The open listbox carries the group name too, hence the selector.
const trigger = () => screen.getByLabelText(/^Scope/, { selector: ".fs__trigger" });

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

  it("is itself the combobox while it is the thing holding focus", () => {
    // `aria-activedescendant` is only valid on a combobox — never on a plain
    // button — and is only honoured on the element with DOM focus. A short
    // group keeps focus on the trigger, so the trigger is the combobox.
    setup();
    expect(trigger()).toHaveAttribute("role", "combobox");
    expect(trigger()).toHaveAttribute("aria-haspopup", "listbox");
  });

  it("hands the combobox role to the filter box when there is one", () => {
    // A long group moves focus into the filter box, so that is what owns the
    // list; the trigger drops back to a plain disclosure button.
    setup({ options: MANY });
    expect(trigger().tagName).toBe("BUTTON");
    expect(trigger()).not.toHaveAttribute("role");

    open();
    const box = screen.getByPlaceholderText(FILTER_PLACEHOLDER);
    expect(box).toHaveAttribute("role", "combobox");
    expect(box).toHaveAttribute("aria-controls", screen.getByRole("listbox").id);
    expect(trigger()).not.toHaveAttribute("aria-activedescendant");
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

  it("takes focus itself when opened by pointer", () => {
    // WebKit — the engine Tauri ships on macOS — does not focus a <button> on
    // click, so without this every key pressed after a pointer-open would go
    // to the document and the popover would ignore the keyboard entirely.
    setup();
    fireEvent.click(trigger());
    expect(trigger()).toHaveFocus();
  });

  it("moves the caret into the option search when there is one", () => {
    setup({ options: MANY });
    open();
    expect(screen.getByPlaceholderText(FILTER_PLACEHOLDER)).toHaveFocus();
  });

  it("leaves Home and End to the caret inside the filter box", () => {
    setup({ options: MANY });
    open();
    const box = screen.getByPlaceholderText(FILTER_PLACEHOLDER);
    fireEvent.keyDown(box, { key: "ArrowDown" });
    const first = screen.getAllByRole("option")[0].id;

    fireEvent.keyDown(box, { key: "End" });

    // A query the user cannot edit from the front is worse than a shortcut
    // they lose, so End moved the caret and not the active option.
    expect(box).toHaveAttribute("aria-activedescendant", first);
  });

  it("keeps the walked-to option in view", () => {
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;
    // jsdom has no scrollIntoView at all; the list scrolls past nine rows and
    // an active row below the fold leaves a keyboard user navigating blind.
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      setup({ options: MANY });
      open();
      fireEvent.keyDown(screen.getByPlaceholderText(FILTER_PLACEHOLDER), { key: "ArrowDown" });
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
    } finally {
      Element.prototype.scrollIntoView = original;
    }
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

  it("closes when focus leaves it entirely", () => {
    render(<button type="button">Elsewhere</button>);
    setup();
    open();
    fireEvent.blur(trigger(), { relatedTarget: screen.getByRole("button", { name: "Elsewhere" }) });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("stays open while focus moves to its own Clear button", () => {
    // Tab is not swallowed, so Clear is an ordinary tab stop — a Clear no
    // keyboard user could reach would fail WCAG 2.1.1.
    setup({ selected: ["orca"] });
    open();
    const clear = screen.getByRole("button", { name: CLEAR_LABEL });
    fireEvent.blur(trigger(), { relatedTarget: clear });
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("lets Enter operate the Clear button rather than swallowing it", () => {
    const { onClear } = setup({ selected: ["orca"] });
    open();
    const clear = screen.getByRole("button", { name: CLEAR_LABEL });
    // The root's key handler must not preventDefault here: that would suppress
    // the click a real browser synthesises from Enter on a focused button.
    const event = fireEvent.keyDown(clear, { key: "Enter", cancelable: true });
    expect(event).toBe(true); // not prevented
    expect(onClear).not.toHaveBeenCalled(); // jsdom synthesises no click
  });
});

describe("FilterSelect: placement", () => {
  /** jsdom measures nothing, so the overflow has to be staged. */
  function stageWidth(right: number) {
    const original = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      if ((this as Element).classList?.contains("fs__popover")) {
        return { right, left: right - 280, top: 0, bottom: 0, width: 280, height: 200, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
      }
      return original.call(this);
    };
    return () => {
      Element.prototype.getBoundingClientRect = original;
    };
  }

  it("opens leftwards when there is room", () => {
    const restore = stageWidth(300);
    try {
      setup();
      open();
      expect(document.querySelector(".fs__popover")).toHaveAttribute("data-align", "left");
    } finally {
      restore();
    }
  });

  it("flips to the trigger's right edge when it would run off the window", () => {
    // The rightmost group in a toolbar has no room to open leftwards, and the
    // window is resizable down to 720px.
    const restore = stageWidth(window.innerWidth + 40);
    try {
      setup();
      open();
      expect(document.querySelector(".fs__popover")).toHaveAttribute("data-align", "right");
    } finally {
      restore();
    }
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

  it("has no axe violations with an option active", async () => {
    // The state the other two never reach: `aria-activedescendant` is only in
    // the DOM once something is active, and it is invalid on a plain button —
    // so an audit taken before the first ArrowDown proves nothing about it.
    const { container } = setup({ selected: ["orca"] });
    open();
    fireEvent.keyDown(trigger(), { key: "ArrowDown" });
    expect(trigger()).toHaveAttribute("aria-activedescendant");
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no axe violations with an option active in a searchable group", async () => {
    const { container } = setup({ options: MANY });
    open();
    const box = screen.getByPlaceholderText(FILTER_PLACEHOLDER);
    fireEvent.keyDown(box, { key: "ArrowDown" });
    expect(box).toHaveAttribute("aria-activedescendant");
    expect(await axe(container)).toHaveNoViolations();
  });
});
