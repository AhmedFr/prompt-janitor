import { screen, fireEvent, within } from "@testing-library/react";

/**
 * Driving a `DataTable`'s filter groups from a screen test.
 *
 * Every group is a `FilterSelect`: a trigger in the toolbar that opens a
 * listbox. Found by its accessible name rather than by role, because the
 * trigger's role depends on the group's size — a short group's trigger is the
 * combobox itself, a searchable group's is a plain disclosure button (see the
 * `FilterSelect` doc comment). Scoped to the toolbar because a column of the
 * same name carries a sort button, and "Grade" would otherwise match both.
 */

/** The toolbar of the only table on screen. */
const toolbar = () => document.querySelector(".dt__toolbar") as HTMLElement;

/** A group's trigger, whatever selection its accessible name now carries. */
export const filterTrigger = (group: string) =>
  within(toolbar()).getByLabelText(new RegExp(`^${group}`), { selector: ".fs__trigger" });

/** Opens a group's popover and hands back its listbox. */
export function openFilterGroup(group: string): HTMLElement {
  fireEvent.click(filterTrigger(group));
  return screen.getByRole("listbox", { name: group });
}

/** An option row inside whichever popover is open, by its label. */
export const filterOption = (label: string) =>
  screen.getByRole("option", { name: new RegExp(`^${label},`) });

/**
 * Picks one option in a group and closes the popover behind it. Closed
 * explicitly rather than by clicking elsewhere: `fireEvent.click` fires no
 * `mousedown`, so the dismissal a real pointer would cause never happens.
 */
export function pickFilter(group: string, option: string): void {
  openFilterGroup(group);
  fireEvent.click(filterOption(option));
  if (screen.queryByRole("listbox", { name: group })) fireEvent.click(filterTrigger(group));
}
