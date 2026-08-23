import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { RuleInfo } from "@/lib/ipc";
import { Rules } from "./Rules";
import { HIGHLIGHT_KEY, TAB_STATE_KEY } from "./Rules.constants";

const listRules = vi.hoisted(() => vi.fn());
const setRule = vi.hoisted(() => vi.fn());
const deleteCustomRule = vi.hoisted(() => vi.fn());
const importPack = vi.hoisted(() => vi.fn());
const getAiConfig = vi.hoisted(() => vi.fn());
const getEntitlement = vi.hoisted(() => vi.fn());
const openDialog = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: openDialog }));

vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return {
    ...actual,
    isTauri: true,
    commands: { listRules, setRule, deleteCustomRule, importPack, getAiConfig, getEntitlement },
  };
});

const rule = (o: Partial<RuleInfo> = {}): RuleInfo => ({
  id: "r1",
  title: "rule",
  description: "what it flags",
  source: "anthropic",
  severity: "mid",
  enabled: true,
  custom: false,
  nl: false,
  pattern: "slack",
  hit_count: 0,
  ...o,
});

const populated: RuleInfo[] = [
  rule({
    id: "b1",
    title: "No Slack references",
    description: "Flags any file that mentions Slack.",
    severity: "hi",
    hit_count: 4,
    pattern: "slack",
  }),
  rule({
    id: "b2",
    title: "Be terse",
    description: "Long preambles cost turns.",
    source: "openai",
    severity: "lo",
    enabled: false,
    hit_count: 0,
    pattern: "verbose",
  }),
  rule({
    id: "c1",
    title: "Never say synergy",
    description: "House style.",
    source: "custom",
    custom: true,
    severity: "mid",
    hit_count: 1,
    pattern: "synergy",
  }),
  rule({
    id: "n1",
    title: "Defines an output format",
    description: "Every prompt must state the shape of its answer.",
    source: "custom",
    custom: true,
    nl: true,
    severity: "hi",
    enabled: false,
    hit_count: 2,
    pattern: "Must define an explicit output format",
  }),
];

/** The title cell of every rendered body row, in order. */
function rowTitles(): string[] {
  return within(screen.getByRole("table"))
    .getAllByRole("row")
    .slice(1)
    .map((tr) => tr.querySelectorAll("td")[1]?.textContent ?? "");
}

const renderScreen = async (props: Partial<Parameters<typeof Rules>[0]> = {}) => {
  const navigate = props.navigate ?? vi.fn();
  const view = render(<Rules navigate={navigate} {...props} />);
  await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
  return { ...view, navigate };
};

const clickTab = (name: RegExp) => fireEvent.click(screen.getByRole("tab", { name }));

describe("Rules", () => {
  beforeEach(() => {
    sessionStorage.clear();
    listRules.mockReset().mockResolvedValue({ status: "ok", data: populated });
    setRule.mockReset().mockResolvedValue({ status: "ok", data: null });
    deleteCustomRule.mockReset().mockResolvedValue({ status: "ok", data: null });
    importPack.mockReset().mockResolvedValue({ status: "ok", data: 3 });
    getAiConfig.mockReset().mockResolvedValue({ status: "ok", data: { provider: "anthropic", has_key: true } });
    getEntitlement.mockReset().mockResolvedValue({ status: "ok", data: { paid: false } });
    openDialog.mockReset().mockResolvedValue("/tmp/pack.json");
  });

  afterEach(cleanup);

  it("counts each tab as enabled out of total", async () => {
    await renderScreen();
    await waitFor(() => expect(screen.getByRole("tab", { name: /Built-in/ })).toHaveTextContent("1/2"));
    expect(screen.getByRole("tab", { name: /Custom/ })).toHaveTextContent("1/1");
    expect(screen.getByRole("tab", { name: /AI standards/ })).toHaveTextContent("0/1");
  });

  it("opens on the built-in rules and shows only those", async () => {
    await renderScreen();
    await waitFor(() => expect(rowTitles()).toHaveLength(2));
    expect(rowTitles().join(" ")).toContain("No Slack references");
    expect(rowTitles().join(" ")).toContain("Be terse");
    expect(rowTitles().join(" ")).not.toContain("Never say synergy");
  });

  it("shows only the user's own pattern rules on the Custom tab", async () => {
    await renderScreen();
    clickTab(/Custom/);
    await waitFor(() => expect(rowTitles()).toHaveLength(1));
    expect(rowTitles()[0]).toContain("Never say synergy");
  });

  it("shows only natural-language rules on the AI standards tab", async () => {
    await renderScreen();
    clickTab(/AI standards/);
    await waitFor(() => expect(rowTitles()).toHaveLength(1));
    expect(rowTitles()[0]).toContain("Defines an output format");
  });

  it("toggles a rule from its switch and persists it", async () => {
    await renderScreen();
    await waitFor(() => expect(rowTitles()).toHaveLength(2));

    fireEvent.click(screen.getByRole("switch", { name: "Enable No Slack references" }));

    await waitFor(() => expect(setRule).toHaveBeenCalledWith("b1", false));
    expect(screen.getByRole("switch", { name: "Enable No Slack references" })).not.toBeChecked();
  });

  it("does not make rows clickable, so a switch can never open something", async () => {
    await renderScreen();
    await waitFor(() => expect(rowTitles()).toHaveLength(2));
    const rows = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    for (const row of rows) expect(row).not.toHaveAttribute("tabindex");
  });

  it("deletes a custom rule and drops it from the table", async () => {
    await renderScreen();
    clickTab(/Custom/);
    await waitFor(() => expect(rowTitles()).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: "Delete Never say synergy" }));

    await waitFor(() => expect(deleteCustomRule).toHaveBeenCalledWith("c1"));
    await waitFor(() => expect(screen.queryByText("Never say synergy")).not.toBeInTheDocument());
  });

  it("copies a built-in rule's pattern to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await renderScreen();
    await waitFor(() => expect(rowTitles()).toHaveLength(2));

    fireEvent.click(screen.getByRole("button", { name: "Copy pattern No Slack references" }));

    expect(writeText).toHaveBeenCalledWith("slack");
  });

  it("survives a renderer with no clipboard rather than throwing at the user", async () => {
    Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true });
    await renderScreen();
    await waitFor(() => expect(rowTitles()).toHaveLength(2));

    expect(() =>
      fireEvent.click(screen.getByRole("button", { name: "Copy pattern No Slack references" })),
    ).not.toThrow();
  });

  it("narrows to a severity through the pills, and drops the rest", async () => {
    await renderScreen();
    await waitFor(() => expect(rowTitles()).toHaveLength(2));

    fireEvent.click(within(screen.getByRole("group", { name: "Severity" })).getByRole("button", { name: /Critical/ }));

    await waitFor(() => expect(rowTitles()).toHaveLength(1));
    expect(rowTitles()[0]).toContain("No Slack references");
    expect(rowTitles().join(" ")).not.toContain("Be terse");
  });

  it("narrows to the rules that are switched off", async () => {
    await renderScreen();
    await waitFor(() => expect(rowTitles()).toHaveLength(2));

    fireEvent.click(within(screen.getByRole("group", { name: "Enabled" })).getByRole("button", { name: /Off/ }));

    await waitFor(() => expect(rowTitles()).toHaveLength(1));
    expect(rowTitles()[0]).toContain("Be terse");
  });

  it("narrows to the rules actually catching something", async () => {
    await renderScreen();
    await waitFor(() => expect(rowTitles()).toHaveLength(2));

    fireEvent.click(within(screen.getByRole("group", { name: "Hits" })).getByRole("button", { name: /Has hits/ }));

    await waitFor(() => expect(rowTitles()).toHaveLength(1));
    expect(rowTitles()[0]).toContain("No Slack references");
  });

  it("searches a rule's title", async () => {
    await renderScreen();
    await waitFor(() => expect(rowTitles()).toHaveLength(2));

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "terse" } });

    await waitFor(() => expect(rowTitles()).toHaveLength(1));
    expect(rowTitles()[0]).toContain("Be terse");
  });

  it("searches a rule's description", async () => {
    await renderScreen();
    await waitFor(() => expect(rowTitles()).toHaveLength(2));

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "preambles" } });

    await waitFor(() => expect(rowTitles()).toHaveLength(1));
    expect(rowTitles()[0]).toContain("Be terse");
  });

  it("searches a rule's pattern, which no column spells out", async () => {
    await renderScreen();
    await waitFor(() => expect(rowTitles()).toHaveLength(2));

    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "verbose" } });

    await waitFor(() => expect(rowTitles()).toHaveLength(1));
    expect(rowTitles()[0]).toContain("Be terse");
  });

  it("sends Add rule to the new-rule flow, carrying the tab it was pressed on", async () => {
    const { navigate } = await renderScreen();
    await waitFor(() => expect(rowTitles()).toHaveLength(2));

    fireEvent.click(screen.getByRole("button", { name: /Add rule/ }));
    expect(navigate).toHaveBeenCalledWith("rules-new", "builtin");

    clickTab(/AI standards/);
    await waitFor(() => expect(rowTitles()).toHaveLength(1));
    fireEvent.click(screen.getByRole("button", { name: /Add rule/ }));
    expect(navigate).toHaveBeenCalledWith("rules-new", "ai");
  });

  it("offers pack import on the built-in tab only", async () => {
    await renderScreen();
    await waitFor(() => expect(rowTitles()).toHaveLength(2));
    expect(screen.getByRole("button", { name: /Import pack/ })).toBeInTheDocument();

    clickTab(/Custom/);
    await waitFor(() => expect(rowTitles()).toHaveLength(1));
    expect(screen.queryByRole("button", { name: /Import pack/ })).not.toBeInTheDocument();
  });

  it("reports how many rules an imported pack added", async () => {
    await renderScreen();
    await waitFor(() => expect(rowTitles()).toHaveLength(2));

    fireEvent.click(screen.getByRole("button", { name: /Import pack/ }));

    await waitFor(() => expect(screen.getByText("Imported 3 rules")).toBeInTheDocument());
    expect(importPack).toHaveBeenCalledWith("/tmp/pack.json");
  });

  it("notes what evaluates the AI standards once a provider is connected", async () => {
    await renderScreen();
    clickTab(/AI standards/);
    await waitFor(() => expect(screen.getByText(/Evaluated by your AI provider/)).toBeInTheDocument());
  });

  it("says a provider is still missing rather than pretending the standards run", async () => {
    getAiConfig.mockResolvedValue({ status: "ok", data: { provider: "none", has_key: false } });
    await renderScreen();
    clickTab(/AI standards/);
    await waitFor(() => expect(screen.getByText(/Settings → AI/)).toBeInTheDocument());
    expect(screen.queryByText(/Evaluated by your AI provider/)).not.toBeInTheDocument();
  });

  it("never gates the AI tab on a licence — monetisation is paused", async () => {
    getEntitlement.mockResolvedValue({ status: "ok", data: { paid: false } });
    await renderScreen();
    clickTab(/AI standards/);
    await waitFor(() => expect(rowTitles()).toHaveLength(1));
    expect(screen.queryByText(/license/i)).not.toBeInTheDocument();
  });

  it("opens on the tab a deep link names, beating the remembered one", async () => {
    sessionStorage.setItem(`pj.tabs.${TAB_STATE_KEY}`, "custom");
    await renderScreen({ initialTab: "ai" });
    await waitFor(() => expect(screen.getByRole("tab", { name: /AI standards/ })).toHaveAttribute("aria-selected", "true"));
    expect(rowTitles()[0]).toContain("Defines an output format");
  });

  it("returns to the remembered tab when no link names one", async () => {
    sessionStorage.setItem(`pj.tabs.${TAB_STATE_KEY}`, "custom");
    await renderScreen();
    await waitFor(() => expect(screen.getByRole("tab", { name: /Custom/ })).toHaveAttribute("aria-selected", "true"));
  });

  it("lands on the row a just-saved rule left behind, and forgets it afterwards", async () => {
    sessionStorage.setItem(HIGHLIGHT_KEY, "b1");
    await renderScreen();
    await waitFor(() => expect(rowTitles()).toHaveLength(2));

    const highlighted = screen.getByRole("table").querySelector(".dt__row--highlight");
    expect(highlighted?.textContent).toContain("No Slack references");
    // Read once: coming back to this screen later must not re-highlight it.
    expect(sessionStorage.getItem(HIGHLIGHT_KEY)).toBeNull();
  });

  it("says the query failed rather than claiming there are no rules", async () => {
    listRules.mockRejectedValue(new Error("database is locked"));
    render(<Rules navigate={vi.fn()} />);

    await waitFor(() => expect(screen.getByText(/rule list query failed/i)).toBeInTheDocument());
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("retries the query from the failure panel", async () => {
    listRules.mockRejectedValue(new Error("database is locked"));
    render(<Rules navigate={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/rule list query failed/i)).toBeInTheDocument());

    listRules.mockResolvedValue({ status: "ok", data: populated });
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));

    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    expect(listRules).toHaveBeenCalledTimes(2);
  });

  it("has no accessibility violations", async () => {
    const { container } = await renderScreen();
    await waitFor(() => expect(rowTitles()).toHaveLength(2));
    expect(await axe(container)).toHaveNoViolations();
  });
});
