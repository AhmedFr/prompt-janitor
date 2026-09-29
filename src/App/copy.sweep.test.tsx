// The regression guard for spec §13a (no purchase text while payments are off)
// and §3.3 (one vocabulary, no hints that point somewhere that cannot help).
// Every surface is swept AFTER its data has loaded: a shell with no rows cannot
// show the copy that regresses (IssueActions, the template picker, populated tables).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
vi.mock("@/lib/ipc", async () => ({
  ...(await vi.importActual<object>("@/lib/ipc")),
  isTauri: true,
  commands: (await import("./copy.sweep.fixtures")).sweepCommands,
}));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(async () => null) }));
// The menu-bar panel drives its own window: focus refetches, Esc hides, it sizes itself.
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({ hide: vi.fn(), setSize: vi.fn(async () => {}), onFocusChanged: vi.fn(async () => () => {}) }),
}));
import { Onboarding } from "@/components/Onboarding";
import { LABEL } from "@/lib/vocabulary";
import { Settings } from "@/screens/Settings";
import { Setup } from "@/screens/Setup";
import { Projects } from "@/screens/Projects";
import { SETTINGS_TABS } from "@/screens/Settings/Settings.constants";
import { Findings } from "@/screens/Setup/Findings";
import { Panel } from "@/screens/Panel";
import { openFilterGroup } from "@/test/filters";

const PURCHASE = /\$\d|Get Pro|paid feature|License/;
const OLD_WORDS =
  /\bRules\b|Rescan|Scan now|Add a folder|Overview tab|Prompts tab|Has issues|Open issues|grades the rules/;

/** Everything a user can read or hear: text, plus title / aria-label / placeholder attributes. */
function copyOnScreen(): string {
  const attrs = [...document.body.querySelectorAll("[title], [aria-label], [placeholder]")].flatMap((el) =>
    ["title", "aria-label", "placeholder"].map((a) => el.getAttribute(a) ?? ""),
  );
  return [document.body.textContent ?? "", ...attrs].join("\n");
}

function sweep(surface: string) {
  const copy = copyOnScreen();
  expect(copy, `${surface}: purchase text`).not.toMatch(PURCHASE);
  expect(copy, `${surface}: retired word`).not.toMatch(OLD_WORDS);
}

/** A string each Settings tab shows only once its data has arrived. */
const LOADED_MARK: Record<string, string | RegExp> = {
  folders: "/work/notes",
  scanning: /Scan/,
  notifications: /notif/i,
  checks: "Wrong package manager",
  ai: /provider/i,
  about: /version/i,
};

beforeEach(() => window.sessionStorage.clear());
afterEach(cleanup);

describe("copy sweep (spec §3.3, §13a) — loaded screens", () => {
  it.each(SETTINGS_TABS.map((t) => t.id))("Settings → %s", async (tab) => {
    render(<Settings navigate={vi.fn()} initialTab={tab} />);
    await screen.findAllByText(LOADED_MARK[tab]);
    sweep(`Settings → ${tab}`);
  });

  it("Setup, populated, on every kind chip", async () => {
    render(<Setup navigate={vi.fn()} />);
    const kinds = await screen.findByRole("radiogroup", { name: "Kinds" });
    await screen.findByText("adapt");
    sweep("Setup · All");
    for (const chip of within(kinds).getAllByRole("radio")) {
      fireEvent.click(chip);
      sweep(`Setup · ${chip.textContent}`);
    }
  });

  it("Setup's grade popover, opened", async () => {
    render(<Setup navigate={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /show health trend/ }));
    await screen.findByText(/open findings?/);
    sweep("Setup · grade popover");
  });

  it("Setup's template picker, opened", async () => {
    render(<Setup navigate={vi.fn()} />);
    fireEvent.click(await screen.findByRole("radio", { name: /^Instructions/ }));
    fireEvent.click(await screen.findByRole("button", { name: /New from template/ }));
    await screen.findAllByText(/React \+ TypeScript/);
    sweep("Setup · template picker");
  });

  it.each([["Content", "Adapts designs."], ["Findings", null], ["Usage", null]])(
    "the item viewer on a skill, %s tab",
    async (tab, text) => {
      render(<Setup navigate={vi.fn()} />);
      fireEvent.click(await screen.findByText("adapt"));
      const viewer = await screen.findByRole("dialog");
      if (text) await within(viewer).findByText(text);
      fireEvent.click(within(viewer).getByRole("tab", { name: new RegExp(`^${tab}`) }));
      await new Promise((r) => setTimeout(r, 30));
      sweep(`Item viewer · ${tab}`);
    },
  );

  it("the item viewer on a graded instruction file, Findings tab (IssueActions)", async () => {
    render(<Setup navigate={vi.fn()} />);
    fireEvent.click(await screen.findByText("global-style"));
    const viewer = await screen.findByRole("dialog");
    fireEvent.click(within(viewer).getByRole("tab", { name: /^Findings/ }));
    await within(viewer).findByText("Wrong package manager");
    sweep("Item viewer · Findings (graded file)");
  });

  it("Findings with a real file, finding expanded (IssueActions)", async () => {
    render(<Findings fileId="f-global" onJumpToLine={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /Wrong package manager/ }));
    await screen.findByText("Repo uses pnpm");
    sweep("Findings · file");
  });

  it("Projects, populated", async () => {
    render(<Projects navigate={vi.fn()} />);
    await screen.findByText("web-app");
    sweep("Projects");
  });

  it("Projects' Status filter, opened", async () => {
    render(<Projects navigate={vi.fn()} />);
    await screen.findByText("web-app");
    openFilterGroup("Status");
    sweep("Projects · Status filter");
  });

  it("Settings → Checks with a check's sheet open", async () => {
    render(<Settings navigate={vi.fn()} initialTab="checks" />);
    fireEvent.click(await screen.findByText("Wrong package manager"));
    await screen.findByRole("dialog");
    sweep("Settings → Checks · check sheet");
  });

  it("the menu-bar panel, populated", async () => {
    render(<Panel />);
    await screen.findByText("acme-api");
    sweep("Panel");
  });

  it("Onboarding at the detect step", async () => {
    render(<Onboarding onDone={vi.fn()} />);
    const scan = await screen.findByRole("button", { name: LABEL.scan });
    await waitFor(() => expect(scan).toBeEnabled());
    sweep("Onboarding · detect");
  });

  it("Onboarding at the reveal step", async () => {
    render(<Onboarding onDone={vi.fn()} />);
    const scan = await screen.findByRole("button", { name: LABEL.scan });
    await waitFor(() => expect(scan).toBeEnabled());
    fireEvent.click(scan);
    await screen.findByRole("button", { name: "Open my setup" });
    sweep("Onboarding · reveal");
  });
});
