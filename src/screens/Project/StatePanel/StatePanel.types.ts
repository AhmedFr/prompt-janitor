export interface StatePanelProps {
  title: string;
  body: string;
  /** Back to the canonical project list — every state offers the way out. */
  onBack: () => void;
  /** Offered only where retrying is a real option: the failed-read state. */
  retry?: { label: string; onClick: () => void };
}
