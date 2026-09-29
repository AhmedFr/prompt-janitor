/** One selectable row inside a {@link FilterSelect}'s popover. */
export interface FilterSelectOption {
  id: string;
  label: string;
  /** How many rows this option would leave on screen — the faceted count. */
  count: number;
}

/**
 * Deliberately not generic over a row type: `FilterSelect` takes options that
 * are already resolved to `{ id, label, count }`, so the table's predicates
 * stay in the table and this control can be reused anywhere a set of named
 * slices needs picking.
 */
export interface FilterSelectProps {
  /** The group's name: what the trigger reads when nothing is selected. */
  label: string;
  options: FilterSelectOption[];
  /** Option ids currently on. Ids the options no longer offer are ignored. */
  selected: string[];
  /** Whether more than one option may be on at once. Single-select closes on pick. */
  multi: boolean;
  onToggle: (optionId: string) => void;
  /** Turns every option in this group off. */
  onClear: () => void;
  /** Show each option's faceted count. Off for a picker whose options are not slices. Default `true`. */
  showCounts?: boolean;
  /**
   * Echo the selection on the trigger and offer "Clear". Off when `label`
   * already names the current choice, as a picker's does. Default `true`.
   */
  showValue?: boolean;
}
