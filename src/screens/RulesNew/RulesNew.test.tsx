import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { RuleInfo } from "@/lib/ipc";
import { HIGHLIGHT_KEY } from "@/screens/Rules/Rules.constants";
import { RulesNew } from "./RulesNew";

const listRules = vi.hoisted(() => vi.fn());
const addCustomRule = vi.hoisted(() => vi.fn());
const addNlRule = vi.hoisted(() => vi.fn());
const getAiConfig = vi.hoisted(() => vi.fn());

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

const renderScreen = (props: Partial<Parameters<typeof RulesNew>[0]> = {}) => {
  const navigate = props.navigate ?? vi.fn();
  const view = render(<RulesNew navigate={navigate} {...props} />);
  return { ...view, navigate };
};

const patternCard = () => screen.getByRole("button", { name: /Pattern rule/ });
const nlCard = () => screen.getByRole("button", { name: /Natural-language standard/ });
const saveButton = () => screen.getByRole("button", { name: /Save rule/ });
const field = (name: RegExp) => screen.getByRole("textbox", { name });

/** Fills both fields of whichever form is open. */
const fill = (title: string, body: string, bodyLabel: RegExp) => {
  fireEvent.change(field(/Rule name/), { target: { value: title } });
  fireEvent.change(field(bodyLabel), { target: { value: body } });
};

describe("RulesNew", () => {
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

  it("asks which kind of rule first, and shows no form until it is answered", () => {
    renderScreen();
    expect(patternCard()).toBeInTheDocument();
    expect(nlCard()).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /Rule name/ })).not.toBeInTheDocument();
  });

  it("opens the pattern form once Pattern rule is chosen", () => {
    renderScreen();
    fireEvent.click(patternCard());
    expect(field(/Rule name/)).toBeInTheDocument();
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

    fireEvent.change(field(/Rule name/), { target: { value: "Never say synergy" } });
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

  it("hands the new rule's id to the Rules screen and lands on Custom", async () => {
    listRules.mockResolvedValue({
      status: "ok",
      data: [rule({ id: "custom-100" }), rule({ id: "custom-700" })],
    });
    const { navigate } = renderScreen();
    fireEvent.click(patternCard());
    fill("Never say synergy", "synergy", /Forbidden text/);
    fireEvent.click(saveButton());

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("rules", "custom"));
    expect(sessionStorage.getItem(HIGHLIGHT_KEY)).toBe("custom-700");
  });

  it("saves a natural-language standard and lands on AI standards", async () => {
    listRules.mockResolvedValue({
      status: "ok",
      data: [rule({ id: "custom-nl-800", nl: true, title: "Names its escape hatch" })],
    });
    const { navigate } = renderScreen();
    await waitFor(() => expect(nlCard()).toBeEnabled());
    fireEvent.click(nlCard());
    fill("Names its escape hatch", "Must say what to do when the answer is unknown", /Instruction/);
    fireEvent.click(saveButton());

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("rules", "ai"));
    expect(addNlRule).toHaveBeenCalledWith(
      "Names its escape hatch",
      "Must say what to do when the answer is unknown",
      "mid",
    );
    expect(sessionStorage.getItem(HIGHLIGHT_KEY)).toBe("custom-nl-800");
  });

  it("still navigates when the new rule cannot be found again — the trip loses its highlight, not its destination", async () => {
    listRules.mockResolvedValue({ status: "ok", data: [] });
    const { navigate } = renderScreen();
    fireEvent.click(patternCard());
    fill("Never say synergy", "synergy", /Forbidden text/);
    fireEvent.click(saveButton());

    await waitFor(() => expect(navigate).toHaveBeenCalledWith("rules", "custom"));
    expect(sessionStorage.getItem(HIGHLIGHT_KEY)).toBeNull();
  });

  it("keeps the form on screen and says so when the save does not land", async () => {
    addCustomRule.mockResolvedValue({ status: "error", error: "database is locked" });
    const { navigate } = renderScreen();
    fireEvent.click(patternCard());
    fill("Never say synergy", "synergy", /Forbidden text/);
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Could not save/));
    expect(navigate).not.toHaveBeenCalled();
    expect(field(/Rule name/)).toHaveValue("Never say synergy");
  });

  it("says the same when the command rejects outright", async () => {
    addCustomRule.mockRejectedValue(new Error("boom"));
    const { navigate } = renderScreen();
    fireEvent.click(patternCard());
    fill("Never say synergy", "synergy", /Forbidden text/);
    fireEvent.click(saveButton());

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/Could not save/));
    expect(navigate).not.toHaveBeenCalled();
  });

  it("opens straight into the natural-language form when the user came from the AI tab", () => {
    renderScreen({ initialType: "ai" });
    expect(field(/Instruction/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Pattern rule/ })).not.toBeInTheDocument();
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
    const { navigate } = renderScreen({ initialType: "custom" });
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(navigate).toHaveBeenCalledWith("rules", "custom");
  });

  it("falls back to Built-in when it was reached without a tab", () => {
    const { navigate } = renderScreen();
    fireEvent.click(screen.getByRole("button", { name: /^Cancel$/ }));
    expect(navigate).toHaveBeenCalledWith("rules", "builtin");
  });

  it("cancels on Escape, from either step", () => {
    const { navigate, unmount } = renderScreen({ initialType: "ai" });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(navigate).toHaveBeenCalledWith("rules", "ai");
    unmount();

    const second = renderScreen({ initialType: "custom" });
    fireEvent.click(patternCard());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(second.navigate).toHaveBeenCalledWith("rules", "custom");
  });

  it("stops listening for Escape once it is gone", () => {
    const { navigate, unmount } = renderScreen();
    unmount();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(navigate).not.toHaveBeenCalled();
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
});
