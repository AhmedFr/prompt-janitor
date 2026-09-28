import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Sidebar } from "@/components/Sidebar";
import { NAV_ITEMS } from "@/components/Sidebar/Sidebar.constants";
import { EMPTY_HINT } from "@/screens/Projects/Projects.constants";
import { Settings } from "@/screens/Settings";
import { SETTINGS_TABS } from "@/screens/Settings/Settings.constants";
import { FoldersTabBody } from "@/screens/Settings/FoldersTab";
import { KIND_LABEL as USAGE_KIND_LABEL } from "@/lib/usage";
import { LABEL } from "@/lib/vocabulary";

vi.mock("@/components/Sidebar/useSidebar", () => ({ useSidebar: () => ({ projects: [], counts: {} }) }));
vi.mock("@/screens/Settings/useSettings", () => ({
  useSettings: () => ({ loading: false, schedule: "6h", digest: true, regressions: true, status: null,
    ai: null, setSchedule: vi.fn(), setDigest: vi.fn(), setRegressions: vi.fn(), saveAi: vi.fn(), testAi: vi.fn() }),
}));

afterEach(cleanup);

/** Labels retired by §3.3. Each must be absent from every surface this file renders. */
const RETIRED = ["Rescan", "Rescan now", "Scan now", "Scan everything", "Add a folder…", "Choose a folder…"];

const texts = (root: HTMLElement) =>
  Array.from(root.querySelectorAll("button, a, [role=tab], [role=radio]")).map((el) => el.textContent?.trim() ?? "");

function renderSidebar() {
  render(<Sidebar active="setup" onNavigate={vi.fn()} onReplay={vi.fn()} />);
  return within(screen.getByRole("navigation", { name: "Primary" })).getAllByRole("button").map((b) => b.textContent?.trim());
}

function renderSettingsTabs() {
  // The Scanning tab: presentational, so no IPC-backed tab body mounts.
  const { container } = render(<Settings navigate={vi.fn()} initialTab="scanning" />);
  return Array.from(container.querySelectorAll(".set-tab")).map((b) => b.textContent?.trim());
}

function renderFolders() {
  const { container } = render(
    <FoldersTabBody
      harnesses={[]}
      extraFolders={["/code/scratch"]}
      scanning={false}
      scanProgress={{ phase: null, progress: null, reset: () => {} }}
      addFolder={async () => {}}
      rescan={async () => {}}
      armed={null}
      askRemove={async () => {}}
      cancelRemove={() => {}}
      confirmRemove={async () => {}}
    />,
  );
  return container;
}

describe("glossary in the UI (spec §3.3)", () => {
  it("renders the sidebar destinations in NAV_ITEMS order, none of them Rules", () => {
    const labels = renderSidebar();
    expect(labels).toEqual(NAV_ITEMS.map((i) => i.label));
    expect(labels).not.toContain("Rules");
  });

  it("renders the Settings tab bar as Folders, Scanning, Notifications, Checks, AI, About", () => {
    const labels = renderSettingsTabs();
    expect(labels).toEqual(SETTINGS_TABS.map((t) => t.label));
    expect(labels).toEqual(["Folders", "Scanning", "Notifications", "Checks", "AI", "About"]);
  });

  it("uses Scan and Add folder… on the Folders tab, and no retired label", () => {
    const container = renderFolders();
    const labels = texts(container);
    expect(labels).toContain(LABEL.scan);
    expect(labels).toContain(LABEL.addFolder);
    expect(labels).not.toContain("Add folder"); // only the ellipsis form
    for (const retired of RETIRED) expect(container.textContent).not.toContain(retired);
  });

  it("shows no retired label on the sidebar or the Settings tab bar", () => {
    renderSidebar();
    renderSettingsTabs();
    for (const retired of RETIRED) expect(document.body.textContent).not.toContain(retired);
  });

  it("names the harness's own tools Harness tools in usage, never Built-in", () => {
    expect(USAGE_KIND_LABEL.builtin).toBe(LABEL.harnessTools);
    expect(Object.values(USAGE_KIND_LABEL)).not.toContain("Built-in");
  });

  it("points empty Projects at the Folders tab, not at Setup", () => {
    expect(EMPTY_HINT).toBe("Add folder… in Settings → Folders and Prompt Janitor will read what it finds inside.");
  });
});
