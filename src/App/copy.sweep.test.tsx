// The regression guard for spec §13a (no purchase text while payments are off)
// and §3.3 (one vocabulary, no hints that point somewhere that cannot help).
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
vi.mock("@/lib/ipc", async () => ({
  ...(await vi.importActual<object>("@/lib/ipc")),
  isTauri: false,
  commands: {},
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
import { Settings } from "@/screens/Settings";
import { Setup } from "@/screens/Setup";
import { Projects } from "@/screens/Projects";
import { SETTINGS_TABS } from "@/screens/Settings/Settings.constants";
import { Findings } from "@/screens/Setup/Findings";

const PURCHASE = /\$\d|Get Pro|paid feature|License/;
const OLD_WORDS = /\bRules\b|Rescan|Add a folder|Overview tab|Prompts tab/;

describe("copy sweep (spec §3.3, §13a)", () => {
  it.each(SETTINGS_TABS.map((t) => t.id))("Settings → %s shows no purchase text", (tab) => {
    const { container } = render(<Settings navigate={vi.fn()} initialTab={tab} />);
    expect(container.textContent).not.toMatch(PURCHASE);
  });

  it("Setup, Projects and Findings use the glossary and no purchase text", () => {
    for (const ui of [
      <Setup navigate={vi.fn()} />,
      <Projects navigate={vi.fn()} />,
      <Findings fileId={null} onJumpToLine={vi.fn()} />,
    ]) {
      const { container, unmount } = render(ui);
      expect(container.textContent).not.toMatch(PURCHASE);
      expect(container.textContent).not.toMatch(OLD_WORDS);
      unmount();
    }
  });
});
