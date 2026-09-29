export interface DiscardConfirmProps {
  /** Back to the editor, draft intact. */
  onKeep: () => void;
  /** Throw the draft away and do what was asked (stop editing, or close). */
  onDiscard: () => void;
}
