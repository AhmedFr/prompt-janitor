export interface StepButtonsProps {
  /** Moves to the row `delta` away in the table's on-screen order. */
  onStep: (delta: -1 | 1) => void;
  /** Held while the viewer is editing, so a step cannot throw a draft away. */
  disabled?: boolean;
}
