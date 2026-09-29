import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ViewingSwitcher } from "./ViewingSwitcher";
import type { ViewingSwitcherProject } from "./ViewingSwitcher.types";

const FEW: ViewingSwitcherProject[] = [
  { path: "/code/api", name: "api", lastSessionAt: "2026-09-20T00:00:00Z" },
  { path: "/code/web", name: "web", lastSessionAt: "2026-09-26T00:00:00Z" },
  { path: "/code/docs", name: "docs", lastSessionAt: null },
];

const MANY: ViewingSwitcherProject[] = Array.from({ length: 14 }, (_, i) => ({
  path: `/code/project-${i + 1}`,
  name: `project-${i + 1}`,
  lastSessionAt: `2026-09-${String(10 + i).padStart(2, "0")}T00:00:00Z`,
}));

/** `ViewingSwitcher` is controlled; every story owns the lens it shows. */
function Demo({ projects, initial = null }: { projects: ViewingSwitcherProject[]; initial?: string | null }) {
  const [lens, setLens] = useState<string | null>(initial);
  return <ViewingSwitcher projects={projects} lens={lens} onChange={setLens} />;
}

const meta: Meta<typeof Demo> = {
  title: "Components/ViewingSwitcher",
  component: Demo,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof Demo>;

export const AllSetup: Story = { args: { projects: FEW } };

export const Lensed: Story = { args: { projects: FEW, initial: "/code/web" } };

/** Past the search threshold the popover grows a filter box. */
export const ManyProjects: Story = { args: { projects: MANY } };
