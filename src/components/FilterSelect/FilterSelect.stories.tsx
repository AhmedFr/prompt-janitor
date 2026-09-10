import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { FilterSelect } from "./FilterSelect";
import { SEARCH_THRESHOLD } from "./FilterSelect.constants";
import type { FilterSelectOption } from "./FilterSelect.types";

const SCOPE: FilterSelectOption[] = [
  { id: "global", label: "Global", count: 41 },
  { id: "orca", label: "orca", count: 8 },
  { id: "prompt-janitor", label: "prompt-janitor", count: 12 },
  { id: "plugin:posthog", label: "posthog", count: 3 },
];

const STATUS: FilterSelectOption[] = [
  { id: "never", label: "Never used", count: 18 },
  { id: "errors", label: "Errors", count: 6 },
  { id: "cost", label: "High cost", count: 2 },
];

/** Setup's Scope group on a machine with enough projects to need the filter box. */
const MANY: FilterSelectOption[] = [
  { id: "global", label: "Global", count: 41 },
  ...Array.from({ length: SEARCH_THRESHOLD }, (_, i) => ({
    id: `p${i}`,
    label: `project-${i + 1}`,
    count: (i * 7) % 23,
  })),
];

/** `FilterSelect` is controlled; every story owns the selection it shows. */
function Demo({
  label,
  options,
  multi = true,
  initial = [],
}: {
  label: string;
  options: FilterSelectOption[];
  multi?: boolean;
  initial?: string[];
}) {
  const [selected, setSelected] = useState(initial);
  return (
    <FilterSelect
      label={label}
      options={options}
      selected={selected}
      multi={multi}
      onToggle={(id) =>
        setSelected((current) =>
          current.includes(id) ? current.filter((x) => x !== id) : multi ? [...current, id] : [id],
        )
      }
      onClear={() => setSelected([])}
    />
  );
}

const meta: Meta<typeof Demo> = {
  title: "Components/FilterSelect",
  component: Demo,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Demo>;

export const Resting: Story = { args: { label: "Scope", options: SCOPE } };

export const OneSelected: Story = {
  args: { label: "Scope", options: SCOPE, initial: ["global"] },
};

export const ManySelected: Story = {
  args: { label: "Status", options: STATUS, initial: ["never", "errors"] },
};

export const SingleSelect: Story = {
  args: { label: "Source", options: STATUS, multi: false, initial: ["errors"] },
};

/** Past `SEARCH_THRESHOLD` options the popover grows its own filter box. */
export const Searchable: Story = { args: { label: "Scope", options: MANY } };

/** How a table toolbar actually wears them: a band of groups beside the search. */
export const Toolbar: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 12px" }}>
      <Demo label="Scope" options={MANY} initial={["global", "p1"]} />
      <Demo label="Status" options={STATUS} initial={["errors"]} />
      <Demo label="Source" options={[{ id: "plugin", label: "Plugin-bundled", count: 4 }]} />
    </div>
  ),
};
