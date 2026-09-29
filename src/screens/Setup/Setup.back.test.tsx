import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, cleanup, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { Setup } from "./Setup";
import { populated } from "./setup.fixtures";
import { useCallback } from "react";
import { NavigationContext, useNavigation } from "@/App/navigation";
import type { SetupProps } from "./Setup.types";
import { DISCARD, DISCARD_TITLE } from "./ItemViewer/DiscardConfirm/DiscardConfirm.constants";

// Back over the real viewer, in a shell that runs on navigation state as the
// app's does: ⌘[ and the toolbar arrow must stop at the discard confirm while
// a draft is unsaved, like every other way out of the sheet.

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(() => Promise.resolve(() => {})) }));

const getSetup = vi.hoisted(() => vi.fn());
const listFiles = vi.hoisted(() => vi.fn());
const getOverview = vi.hoisted(() => vi.fn());
const listTemplates = vi.hoisted(() => vi.fn());
const getEntitlement = vi.hoisted(() => vi.fn());
const getArtifactSource = vi.hoisted(() => vi.fn());
const saveArtifactSource = vi.hoisted(() => vi.fn());
const getFileDetail = vi.hoisted(() => vi.fn());
const getAiConfig = vi.hoisted(() => vi.fn());
const hasBackup = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return {
    ...actual,
    isTauri: true,
    commands: {
      getSetup,
      listFiles,
      getOverview,
      listTemplates,
      getEntitlement,
      getArtifactSource,
      saveArtifactSource,
      getFileDetail,
      getAiConfig,
      hasBackup,
    },
  };
});


/** The app's wiring of Setup, minus the rest of the shell. */
function Shell() {
  const nav = useNavigation();
  const { push, replace } = nav;
  const onTargetChange = useCallback<NonNullable<SetupProps["onTargetChange"]>>(
    (target, mode) => (mode === "push" ? push : replace)({ route: "setup", target }),
    [push, replace],
  );
  return (
    <NavigationContext.Provider value={nav}>
      <Setup navigate={nav.navigate} target={nav.state.route === "setup" ? nav.state.target : {}}
        onTargetChange={onTargetChange} onCloseItem={nav.closeItem} />
    </NavigationContext.Provider>
  );
}

const bodyRows = () => [...document.querySelectorAll<HTMLElement>("tbody tr.dt__row")];
const rowFor = (name: string) =>
  bodyRows().find((row) => (row.querySelector("td")?.textContent ?? "").startsWith(name)) as HTMLElement;
const cmdBracket = () =>
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "[", metaKey: true, cancelable: true }));
  });
const backArrow = () => screen.getByRole("button", { name: "Back", hidden: true });

/** Setup narrowed to Skills (one push), then `adapt` open in the viewer (a second). */
const openAdapt = async () => {
  render(<Shell />);
  await screen.findByRole("radiogroup", { name: "Kinds" });
  fireEvent.click(screen.getByRole("radio", { name: /^Skills/ }));
  fireEvent.click(rowFor("adapt"));
  const viewer = await screen.findByRole("dialog");
  await within(viewer).findByRole("heading", { name: "From disk" });
  return viewer;
};

/** An unsaved edit, with focus moved off the textarea (to the Content tab). */
const makeDirty = (viewer: HTMLElement) => {
  fireEvent.click(within(viewer).getByRole("button", { name: "Edit" }));
  fireEvent.change(within(viewer).getByRole("textbox", { name: "Item source" }), { target: { value: "# Edited" } });
  within(viewer).getByRole("button", { name: "Cancel" }).focus();
  expect(document.activeElement).not.toBeInstanceOf(HTMLTextAreaElement);
};

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
  getSetup.mockResolvedValue({ status: "ok", data: populated });
  listFiles.mockResolvedValue({ status: "ok", data: [] });
  getOverview.mockResolvedValue({ status: "ok", data: { has_data: false, overall_grade: "F" } });
  listTemplates.mockResolvedValue([]);
  getEntitlement.mockResolvedValue({ status: "ok", data: { paid: false } });
  getArtifactSource.mockResolvedValue({
    status: "ok",
    data: { path: "/s/SKILL.md", content: "# From disk\n", bytes: 12, modified: "111", format: "markdown", editable: true },
  });
  saveArtifactSource.mockResolvedValue({ status: "ok", data: { bytes: 20 } });
  getAiConfig.mockResolvedValue({ status: "ok", data: { provider: "none", has_key: false } });
  hasBackup.mockResolvedValue({ status: "ok", data: false });
});

afterEach(cleanup);

describe("Setup — Back over the viewer", () => {
  it("⌘[ over a dirty editor with focus off the textarea shows the discard confirmation and keeps the viewer open", async () => {
    const viewer = await openAdapt();
    makeDirty(viewer);
    cmdBracket();
    expect(screen.getByRole("alertdialog", { name: DISCARD_TITLE })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBe(viewer);
    expect(within(viewer).getByRole("textbox", { name: "Item source" })).toHaveValue("# Edited");
  });

  it("the toolbar arrow over a dirty editor asks too", async () => {
    const viewer = await openAdapt();
    makeDirty(viewer);
    fireEvent.click(backArrow());
    expect(screen.getByRole("alertdialog", { name: DISCARD_TITLE })).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBe(viewer);
  });

  it("closes a clean viewer on Back", async () => {
    await openAdapt();
    cmdBracket();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("radio", { name: /^Skills/ })).toBeChecked();
  });

  it("closes on a confirmed discard, as one history step", async () => {
    const viewer = await openAdapt();
    makeDirty(viewer);
    cmdBracket();
    fireEvent.click(screen.getByRole("button", { name: DISCARD }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("radio", { name: /^Skills/ })).toBeChecked();
    // Opening pushed one entry and closing popped it: the next Back undoes the chip.
    cmdBracket();
    expect(screen.getByRole("radio", { name: /^All/ })).toBeChecked();
  });
});
