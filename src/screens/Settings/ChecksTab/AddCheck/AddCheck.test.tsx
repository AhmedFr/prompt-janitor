import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { RuleInfo } from "@/lib/ipc";
import { HIGHLIGHT_KEY } from "../ChecksLibrary/ChecksLibrary.constants";
import { ChecksLibrary } from "../ChecksLibrary";
import { AddCheck } from "./AddCheck";

const listRules = vi.hoisted(() => vi.fn());
const addCustomRule = vi.hoisted(() => vi.fn());
const addNlRule = vi.hoisted(() => vi.fn());
const getAiConfig = vi.hoisted(() => vi.fn());

// Pulled in by `useChecksLibrary` when the check library renders at the end
// of the round trip below; never called, and never allowed to reach a real
// dialog.
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return {
    ...actual,
    isTauri: true,
    commands: { listRules, addCustomRule, addNlRule, getAiConfig },
  };
});

const rule = (o: Partial<RuleInfo> = {}): RuleInfo => ({
  id: "custom-1",
  title: "Never say synergy",
  description: "",
  source: "custom",
  severity: "mid",
  enabled: true,
  custom: true,
  nl: false,
  pattern: "synergy",
  hit_count: 0,
  ...o,
});

const renderScreen = (props: Partial<Parameters<typeof AddCheck>[0]> = {}) => {
  const onDone = props.onDone ?? vi.fn();
  const view = render(<AddCheck onDone={onDone} {...props} />);
  return { ...view, onDone };
};

const patternCard = () => screen.getByRole("button", { name: /Pattern check/ });
const nlCard = () => screen.getByRole("button", { name: /AI check/ });
const saveButton = () => screen.getByRole("button", { name: /Save check/ });
const field = (name: RegExp) => screen.getByRole("textbox", { name });

/** Fills both fields of whichever form is open. */
const fill = (title: string, body: string, bodyLabel: RegExp) => {
  fireEvent.change(field(/Check name/), { target: { value: title } });
  fireEvent.change(field(bodyLabel), { target: { value: body } });
};

describe("AddCheck", () => {
  beforeEach(() => {
    sessionStorage.clear();
    listRules.mockReset().mockResolvedValue({ status: "ok", data: [rule({ id: "custom-900" })] });
    addCustomRule.mockReset().mockResolvedValue({ status: "ok", data: null });
    addNlRule.mockReset().mockResolvedValue({ status: "ok", data: null });
    getAiConfig
      .mockReset()
      .mockResolvedValue({ status: "ok", data: { provider: "anthropic", has_key: true } });
  });

  afterEach(cleanup);

  it("asks which kind of check first, and shows no form until it is answered", () => {
    renderScreen();
    expect(patternCard()).toBeInTheDocument();
    expect(nlCard()).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Check name/ })).not.toBeInTheDocument();
  });

  it("opens the pattern form once Pattern check is chosen", () => {
    renderScreen();
    fireEvent.click(patternCard());
    expect(field(/Check name/)).toBeInTheDocument();
    expect(field(/Forbidden text/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Warning" })).toBeChecked();
  });

  it("disables the natural-language card and says what it is waiting on", async () => {
    getAiConfig.mockResolvedValue({ status: "ok", data: { provider: "none", has_key: false } });
    renderScreen();
    await waitFor(() => expect(nlCard()).toBeDisabled());
    expect(screen.getByText(/Connect an AI provider/)).toBeInTheDocument();
    expect(patternCard()).toBeEnabled();
  });

  it("keeps the natural-language card usable once a provider is configured", async () => {
    renderScreen();
    await waitFor(() => expect(getAiConfig).toHaveBeenCalled());
    expect(nlCard()).toBeEnabled();
    expect(screen.queryByText(/Connect an AI provider/)).not.toBeInTheDocument();
  });

  it("holds Save back until both fields are filled", () => {
    renderScreen();
    fireEvent.click(patternCard());
    expect(saveButton()).toBeDisabled();

    fireEvent.change(field(/Check name/), { target: { value: "Never say synergy" } });
    expect(saveButton()).toBeDisabled();

    fireEvent.change(field(/Forbidden text/), { target: { value: "synergy" } });
    expect(saveButton()).toBeEnabled();
  });

  it("treats whitespace as empty", () => {
    renderScreen();
    fireEvent.click(patternCard());
    fill("   ", "   ", /Forbidden text/);
    expect(saveButton()).toBeDisabled();
  });

  it("saves a pattern rule with the severity that is selected", async () => {
    renderScreen();
    fireEvent.click(patternCard());
    fill("Never say synergy", "synergy", /Forbidden text/);
    fireEvent.click(screen.getByRole("radio", { name: "Critical" }));
    fireEvent.click(saveButton());

    await waitFor(() => expect(addCustomRule).toHaveBeenCalledWith("Never say synergy", "synergy", "hi"));
    expect(addNlRule).not.toHaveBeenCalled();
  });

  it("hands the new check's id to the check library and lands on Custom", async () => {
    listRules.mockResolvedValue({
      status: "ok",
      data: [rule({ id: "custom-100" }), rule({ id: "custom-700" })],
    });
    const { onDone } = renderScreen();
    fireEvent.click(patternCard());
    fill("Never say synergy", "synergy", /Forbidden text/);
    fireEvent.click(saveButton());

    await waitFor(() => expect(onDone).toHaveBeenCalledWith("custom"));
    expect(sessionStorage.getItem(HIGHLIGHT_KEY)).toBe("custom-700");
  });

  /**
   * The round trip, end to end. Each tab's table remembers its own search, so
   * a search left over from an earlier visit would filter the brand-new row
   * straight back out — the user lands on a table that does not contain the
   * rule they just wrote, with the highlight pointing at nothing.
   */
  it("clears the destination tab's remembered search, so the new row survives its own arrival", async () => {
    // The literal key on purpose: this is the contract with `DataTable`, and
    // composing it here would let both sides drift together unnoticed.
    sessionStorage.setItem("pj.table.rules.custom", JSON.stringify({ search: "hostnames" }));
    listRules.mockResolvedValue({
      status: "ok",
      data: [
        rule({ id: "custom-100", title: "No internal hostnames", pattern: "corp.internal" }),
        rule({ id: "custom-700", title: "Never say synergy" }),
      ],
    });

    const { onDone, unmount } = renderScreen();
    fireEvent.click(patternCard());
    fill("Never say synergy", "synergy", /Forbidden text/);
    fireEvent.click(saveButton());

    await waitFor(() => expect(onDone).toHaveBeenCalledWith("custom"));
    expect(sessionStorage.getItem("pj.table.rules.custom")).toBeNull();
    unmount();

    render(<ChecksLibrary onAdd={vi.fn()} initialTab="custom" />);
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    await waitFor(() => {
      const highlighted = screen.getByRole("table").querySelector(".dt__row--highlight");
      expect(highlighted?.textContent).toContain("Never say synergy");
    });
  });

  it("saves an AI check and lands on AI checks", async () => {
    listRules.mockResolvedValue({
      status: "ok",
      data: [rule({ id: "custom-nl-800", nl: true, title: "Names its escape hatch" })],
    });
    const { onDone } = renderScreen();
    await waitFor(() => expect(nlCard()).toBeEnabled());
    fireEvent.click(nlCard());
    fill("Names its escape hatch", "Must say what to do when the answer is unknown", /Instruction/);
    fireEvent.click(saveButton());

    await waitFor(() => expect(onDone).toHaveBeenCalledWith("ai"));
    expect(addNlRule).toHaveBeenCalledWith(
      "Names its escape hatch",
      "Must say what to do when the answer is unknown",
      "mid",
    );
    expect(sessionStorage.getItem(HIGHLIGHT_KEY)).toBe("custom-nl-800");
  });

  it("still finishes when the new rule cannot be found again — the trip loses its highlight, not its destination", async () => {
    listRules.mockResolvedValue({ status: "ok", data: [] });
    const { onDone } = renderScreen();
    fireEvent.click(patternCard());
    fill("Never say synergy", "synergy", /Forbidden text/);
    fireEvent.click(saveButton());

    await waitFor(() => expect(onDone).toHaveBeenCalledWith("custom"));
    expect(sessionStorage.getItem(HIGHLIGHT_KEY)).toBeNull();
  });

  it("keeps the form on screen and says so when the save does not land", async () => {
    addCustomRule.mockResolvedValue({ status: "error", error: "database is locked" });
    const { onDone } = renderScreen();
    fireEvent.click(patternCard());
    fill("Never say synergy", "synergy", /Forbidden text/);
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Could not save/));
    expect(onDone).not.toHaveBeenCalled();
    expect(field(/Check name/)).toHaveValue("Never say synergy");
  });

  it("says the same when the command rejects outright", async () => {
    addCustomRule.mockRejectedValue(new Error("boom"));
    const { onDone } = renderScreen();
    fireEvent.click(patternCard());
    fill("Never say synergy", "synergy", /Forbidden text/);
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Could not save/));
    expect(onDone).not.toHaveBeenCalled();
  });

  it("opens straight into the natural-language form when the user came from the AI tab", () => {
    renderScreen({ initialType: "ai" });
    expect(field(/Instruction/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pattern check/ })).not.toBeInTheDocument();
  });

  it("blocks the natural-language save when the deep link outran the provider check", async () => {
    getAiConfig.mockResolvedValue({ status: "ok", data: { provider: "none", has_key: false } });
    renderScreen({ initialType: "ai" });
    fill("Names its escape hatch", "Must say what to do", /Instruction/);
    await waitFor(() => expect(saveButton()).toBeDisabled());
    expect(screen.getByText(/Connect an AI provider/)).toBeInTheDocument();
  });

  it("goes back to the type step from the form", () => {
    renderScreen();
    fireEvent.click(patternCard());
    fireEvent.click(screen.getByRole("button", { name: /Change type/ }));
    expect(patternCard()).toBeInTheDocument();
  });

  it("returns to the tab the user came from on Cancel", () => {
    const { onDone } = renderScreen({ initialType: "custom" });
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(onDone).toHaveBeenCalledWith("custom");
  });

  it("falls back to Built-in when it was reached without a tab", () => {
    const { onDone } = renderScreen();
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(onDone).toHaveBeenCalledWith("builtin");
  });

  it("falls back to Built-in when the tab it was reached with does not exist", () => {
    const { onDone } = renderScreen({ initialType: "not-a-tab" });
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(onDone).toHaveBeenCalledWith("builtin");
  });

  it("leaves an IME candidate list alone — that Escape is not meant for us", () => {
    const { onDone } = renderScreen({ initialType: "ai" });
    fireEvent.keyDown(window, { key: "Escape", isComposing: true });
    expect(onDone).not.toHaveBeenCalled();
  });

  it("leaves an Escape something closer to the user already handled", () => {
    const { onDone } = renderScreen({ initialType: "ai" });
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    event.preventDefault();
    fireEvent(window, event);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("will not abandon a save that is already in flight", async () => {
    let land: (value: { status: "ok"; data: null }) => void = () => {};
    addCustomRule.mockReturnValue(new Promise((resolve) => (land = resolve)));
    const { onDone } = renderScreen();
    fireEvent.click(patternCard());
    fill("Never say synergy", "synergy", /Forbidden text/);
    fireEvent.click(saveButton());
    await waitFor(() => expect(addCustomRule).toHaveBeenCalled());

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDone).not.toHaveBeenCalled();

    land({ status: "ok", data: null });
    await waitFor(() => expect(onDone).toHaveBeenCalledWith("custom"));
  });

  it("writes once when Save is pressed twice in the same tick", async () => {
    renderScreen();
    fireEvent.click(patternCard());
    fill("Never say synergy", "synergy", /Forbidden text/);

    // Both clicks land before React re-renders, so the disabled attribute has
    // not appeared yet — which is the case the state flag cannot catch and the
    // ref inside `save` has to.
    const save = saveButton();
    act(() => {
      save.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      save.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await waitFor(() => expect(addCustomRule).toHaveBeenCalledTimes(1));
  });

  it("cancels on Escape, from either step", () => {
    const { onDone, unmount } = renderScreen({ initialType: "ai" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDone).toHaveBeenCalledWith("ai");
    unmount();

    const second = renderScreen({ initialType: "custom" });
    fireEvent.click(patternCard());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(second.onDone).toHaveBeenCalledWith("custom");
  });

  it("stops listening for Escape once it is gone", () => {
    const { onDone, unmount } = renderScreen();
    unmount();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onDone).not.toHaveBeenCalled();
  });

  it("has no accessibility violations on the type step", async () => {
    getAiConfig.mockResolvedValue({ status: "ok", data: { provider: "none", has_key: false } });
    const { container } = renderScreen();
    await waitFor(() => expect(nlCard()).toBeDisabled());
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations on the form step", async () => {
    const { container } = renderScreen();
    fireEvent.click(patternCard());
    await waitFor(() => expect(getAiConfig).toHaveBeenCalled());
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no accessibility violations on the gated natural-language form", async () => {
    getAiConfig.mockResolvedValue({ status: "ok", data: { provider: "none", has_key: false } });
    const { container } = renderScreen({ initialType: "ai" });
    await waitFor(() => expect(saveButton()).toBeDisabled());
    // The disabled Save is described by the sentence explaining it, so the
    // reason is reachable from the control rather than only from the page.
    expect(saveButton()).toHaveAccessibleDescription(/Connect an AI provider/);
    expect(await axe(container)).toHaveNoViolations();
  });
});
