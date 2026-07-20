import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { Sidebar } from "./Sidebar";
import type { Route } from "@/App/App.types";
import "@/styles/shell.css";

/**
 * The app-shell navigation rail. The Projects list and the nav badge counts are
 * loaded from the Tauri backend at runtime, so they appear empty here in
 * Storybook — this story exercises the brand, icons, active state, and footer.
 */
const meta = {
  title: "Components/Sidebar",
  component: Sidebar,
  args: { active: "overview", onNavigate: () => {} },
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div style={{ height: "100vh", width: 232, background: "var(--sidebar)" }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Sidebar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Interactive wrapper so clicking a nav item moves the active highlight. */
function InteractiveSidebar() {
  const [active, setActive] = useState<Route>("overview");
  return <Sidebar active={active} onNavigate={setActive} onReplay={() => {}} />;
}

export const Default: Story = {
  render: () => <InteractiveSidebar />,
};
