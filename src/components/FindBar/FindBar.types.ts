/** What {@link useFind} hands back. */
export interface FindState {
  /** How many matches the current query has. */
  count: number;
  /** Index of the current match, or -1 when there is none. */
  current: number;
  next: () => void;
  prev: () => void;
}

export interface FindBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  count: number;
  /** Index of the current match, or -1. */
  current: number;
  onNext: () => void;
  onPrev: () => void;
  /** Esc, or the close button. */
  onClose: () => void;
  /** Bump to pull focus back into the field (⌘F pressed while find is open). */
  focusSignal?: number;
}
