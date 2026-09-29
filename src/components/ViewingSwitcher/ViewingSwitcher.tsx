import { useMemo } from "react";
import { FilterSelect } from "@/components/FilterSelect";
import { ALL_ID, ALL_SETUP, sees } from "./ViewingSwitcher.constants";
import type { ViewingSwitcherProps } from "./ViewingSwitcher.types";

/** Setup's lens control: the whole setup, or what Claude Code loads in one project (spec §4.1). */
export function ViewingSwitcher({ projects, lens, onChange }: ViewingSwitcherProps) {
  const ordered = useMemo(
    () =>
      [...projects].sort(
        (a, b) => (b.lastSessionAt ?? "").localeCompare(a.lastSessionAt ?? "") || a.name.localeCompare(b.name),
      ),
    [projects],
  );
  const current = ordered.find((p) => p.path === lens);
  const options = useMemo(
    () => [
      { id: ALL_ID, label: ALL_SETUP, count: 0 },
      ...ordered.map((p) => ({ id: p.path, label: p.name, count: 0 })),
    ],
    [ordered],
  );
  return (
    <FilterSelect
      label={`Viewing: ${current ? sees(current.name) : ALL_SETUP}`}
      multi={false}
      showCounts={false}
      showValue={false}
      selected={[current ? current.path : ALL_ID]}
      options={options}
      onToggle={(id) => onChange(id === ALL_ID ? null : id)}
      onClear={() => onChange(null)}
    />
  );
}
