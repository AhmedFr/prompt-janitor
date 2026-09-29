import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { Sidebar } from "@/components/Sidebar";
import { NAV_ITEMS } from "@/components/Sidebar/Sidebar.constants";
import { EMPTY_HINT } from "@/screens/Projects/Projects.constants";
import { Settings } from "@/screens/Settings";
import { SETTINGS_TABS } from "@/screens/Settings/Settings.constants";
import { FoldersTabBody } from "@/screens/Settings/FoldersTab";
import { LABEL, KIND_CHIP_ORDER, KIND_LABEL } from "@/lib/vocabulary";
import { KindChips } from "@/components/KindChips";

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
  it("renders exactly Setup, Projects, Settings in the sidebar, and no retired destination", () => {
    const labels = renderSidebar();
    expect(labels).toEqual(["Setup", "Projects", "Settings"]);
    expect(labels).toEqual(NAV_ITEMS.map((i) => i.label));
    for (const gone of ["Overview", "Prompts", "Scans", "Analytics", "Rules"]) expect(labels).not.toContain(gone);
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

  it("points empty Projects at the Folders tab, not at Setup", () => {
    expect(EMPTY_HINT).toBe("Add folder… in Settings → Folders and Prompt Janitor will read what it finds inside.");
  });

  it("renders the kind chips as All, then every kind's vocabulary label, in chip order", () => {
    render(<KindChips counts={{}} active="all" onChange={vi.fn()} />);
    const labels = screen.getAllByRole("radio").map((b) => b.textContent?.replace(/\d+$/, ""));
    expect(labels).toEqual(KIND_CHIP_ORDER.map((k) => (k === "all" ? LABEL.all : KIND_LABEL[k])));
    expect(labels).toEqual([
      "All", "Instructions", "Skills", "Agents", "Commands", "MCP servers", "Hooks", "Plugins", "Config",
    ]);
    for (const retired of ["Rules", "Prompts", "Settings", "MCP"]) expect(labels).not.toContain(retired);
  });
});
