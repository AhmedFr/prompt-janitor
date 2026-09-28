import type { KindFilter } from "@/lib/vocabulary";

export interface KindChipsProps {
  /** Items per chip in the current view; a missing kind counts 0. */
  counts: Partial<Record<KindFilter, number>>;
  active: KindFilter;
  onChange: (kind: KindFilter) => void;
}
