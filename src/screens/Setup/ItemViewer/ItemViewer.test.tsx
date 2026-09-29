import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { ArtifactSourceState } from "../Setup.types";
import type { SetupRow } from "../setupRows.util";

const getArtifactSource = vi.hoisted(() => vi.fn());
const saveArtifactSource = vi.hoisted(() => vi.fn());
const openArtifact = vi.hoisted(() => vi.fn());
const getFileDetail = vi.hoisted(() => vi.fn());
const openFile = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return {
    ...actual,
    isTauri: true,
    commands: { getArtifactSource, saveArtifactSource, openArtifact, getFileDetail, openFile },
  };
});
vi.mock("../Findings", () => ({
  Findings: ({ onJumpToLine, onChanged }: { onJumpToLine: (l: number) => void; onChanged?: () => void }) => (
    <>
      <button onClick={() => onJumpToLine(2)}>jump</button>
      <button onClick={() => onChanged?.()}>fix landed</button>
    </>
  ),
}));
vi.mock("../ItemUsage", () => ({ ItemUsage: () => <div data-testid="item-usage" /> }));

import { ItemViewer, ItemViewerView } from "./index";

const ok = <T,>(data: T) => ({ status: "ok" as const, data });
const err = (error: string) => ({ status: "error" as const, error });

const SOURCE = ["---", "name: adapt", "description: Adapts designs", "---", "# Adapt", "", "Body text."].join("\n");

const skill = (over: Partial<SetupRow> = {}): SetupRow => ({
  id: 7,
  harness: "claude_code",
  layer: "global",
  kind: "skill",
  name: "adapt",
  path: "/Users/a/.claude/skills/adapt/SKILL.md",
  plugin_name: null,
  description: "Adapts designs",
  bytes: 64,
  grade: null,
  score: null,
  file_id: null,
  issue_count: null,
  worst_severity: null,
  usage: null,
  origin: "inventory",
  project_label: null,
  project_path: null,
  load_order: null,
  ...over,
});

/** Renders the viewer and waits for the initial read to land. */
async function open(props: Partial<Parameters<typeof ItemViewer>[0]> = {}) {
  const onClose = vi.fn();
  const item = props.item ?? skill();
  const view = render(
    <ItemViewer
      item={item}
      scope="Global"
      tab="content"
      onTab={vi.fn()}
      onClose={onClose}
      loadedIn={[]}
      onSelectProject={vi.fn()}
      {...props}
    />,
  );
  await waitFor(() => expect(screen.queryByText(`Reading ${item.name}…`)).not.toBeInTheDocument());
  return { ...view, onClose };
}

beforeEach(() => {
  getArtifactSource
    .mockReset()
    .mockResolvedValue(ok({ path: "/s/SKILL.md", content: SOURCE, bytes: 64, modified: "111", format: "markdown", editable: true }));
  saveArtifactSource.mockReset().mockResolvedValue(ok({ bytes: 12 }));
  openArtifact.mockReset().mockResolvedValue(ok(null));
  getFileDetail.mockReset();
  openFile.mockReset().mockResolvedValue(ok(null));
});

afterEach(cleanup);

describe("ItemViewer", () => {
  it("names the skill it opened", async () => {
    await open();
    expect(screen.getByRole("dialog")).toHaveAccessibleName(/adapt/);
  });

  it("renders the body as markdown, not as raw text", async () => {
    await open();
    expect(screen.getByRole("heading", { name: "Adapt" })).toBeInTheDocument();
  });

  it("shows the frontmatter fields as a key/value strip", async () => {
    await open();
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("Adapts designs")).toBeInTheDocument();
  });

  /**
   * The header used to print the indexed description too. Two copies of one
   * sentence is noise, and the indexed one goes stale the moment the file is
   * edited here — so only the file's own header is shown.
   */
  it("shows the description once, from the file rather than from the index", async () => {
    await open();
    expect(screen.getAllByText("Adapts designs")).toHaveLength(1);
  });

  it("does not render the frontmatter fence as body text", async () => {
    await open();
    expect(screen.queryByText("---")).not.toBeInTheDocument();
  });

  it("says so while the file is loading", () => {
    getArtifactSource.mockReturnValue(new Promise(() => {}));
    render(
      <ItemViewer
        item={skill()}
        scope="Global"
        tab="content"
        onTab={vi.fn()}
        onClose={vi.fn()}
        loadedIn={[]}
        onSelectProject={vi.fn()}
      />,
    );
    expect(screen.getByText("Reading adapt…")).toBeInTheDocument();
  });

  it("shows a failed read instead of an empty document", async () => {
    getArtifactSource.mockResolvedValue(err("Couldn't read the file: nope"));
    await open();
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't read the file: nope");
  });

  it("shows the exact file, frontmatter and all, in the Source view", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    const region = screen.getByRole("region", { name: "adapt source" });
    expect(region.querySelectorAll(".cv__text")[1]).toHaveTextContent("name: adapt");
  });

  it("reveals the file in Finder on request", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    await waitFor(() => expect(openArtifact).toHaveBeenCalledWith(7, "reveal"));
  });

  it("offers Edit only for a file the backend will accept a save for", async () => {
    getArtifactSource.mockResolvedValue(
      ok({ path: "/s/SKILL.md", content: SOURCE, bytes: 64, modified: "111", format: "markdown", editable: false }),
    );
    await open();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("closes on the close button", async () => {
    const { onClose } = await open();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("closes on Escape", async () => {
    const { onClose } = await open();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  describe("editing", () => {
    /** Switch to edit mode and return the textarea. */
    const startEditing = () => {
      fireEvent.click(screen.getByRole("button", { name: "Edit" }));
      return screen.getByRole("textbox", { name: /item source/i });
    };

    it("puts the cursor in the editor, since Edit is a request to type", async () => {
      await open();
      expect(startEditing()).toHaveFocus();
    });

    it("puts the raw file — frontmatter included — into the editor", async () => {
      await open();
      expect(startEditing()).toHaveValue(SOURCE);
    });

    it("saves the edited text and returns to reading it", async () => {
      await open();
      fireEvent.change(startEditing(), { target: { value: "# Edited" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() =>
        // The read's stamp travels with the write; see `useSkillSource`.
        expect(saveArtifactSource).toHaveBeenCalledWith(7, "# Edited", "111"),
      );
      await waitFor(() => expect(screen.getByRole("heading", { name: "Edited" })).toBeInTheDocument());
    });

    it("tells the caller a save landed, so the table can refresh", async () => {
      const onSaved = vi.fn();
      await open({ onSaved });
      fireEvent.change(startEditing(), { target: { value: "# Edited" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(onSaved).toHaveBeenCalled());
    });

    it("does not claim a save landed when it failed", async () => {
      saveArtifactSource.mockResolvedValue(err("nope"));
      const onSaved = vi.fn();
      await open({ onSaved });
      fireEvent.change(startEditing(), { target: { value: "# Edited" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
      expect(onSaved).not.toHaveBeenCalled();
    });

    it("stays in the editor and says why when the save fails", async () => {
      saveArtifactSource.mockResolvedValue(err("That file is no longer on disk."));
      await open();
      fireEvent.change(startEditing(), { target: { value: "# Edited" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() =>
        expect(screen.getByRole("alert")).toHaveTextContent("That file is no longer on disk."),
      );
      expect(screen.getByRole("textbox", { name: /item source/i })).toHaveValue("# Edited");
    });

    it("marks the editor dirty only once the text actually differs", async () => {
      await open();
      const editor = startEditing();
      expect(screen.queryByText("Unsaved")).not.toBeInTheDocument();

      fireEvent.change(editor, { target: { value: "# Edited" } });
      expect(screen.getByText("Unsaved")).toBeInTheDocument();

      fireEvent.change(editor, { target: { value: SOURCE } });
      expect(screen.queryByText("Unsaved")).not.toBeInTheDocument();
    });

    it("discards the draft on cancel when nothing was changed", async () => {
      await open();
      startEditing();
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(screen.getByRole("heading", { name: "Adapt" })).toBeInTheDocument();
    });

    /**
     * Every close route has to ask, not just the ones the first pass tested.
     * The X button is the most obvious way out of the panel, and it used to
     * discard a draft silently.
     */
    it.each([
      ["the close button", () => fireEvent.click(screen.getByRole("button", { name: "Close" }))],
      ["the scrim", () => fireEvent.mouseDown(document.querySelector(".sheet-scrim")!)],
      ["Escape", () => fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })],
      ["Cancel", () => fireEvent.click(screen.getByRole("button", { name: "Cancel" }))],
    ])("asks before %s throws away unsaved edits", async (_label, close) => {
      const { onClose } = await open();
      fireEvent.change(startEditing(), { target: { value: "# Edited" } });

      close();

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("alertdialog")).toHaveTextContent(/unsaved/i);
    });

    it("returns to reading, not closing, when Cancel's discard is confirmed", async () => {
      const { onClose } = await open();
      fireEvent.change(startEditing(), { target: { value: "# Edited" } });
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      fireEvent.click(screen.getByRole("button", { name: "Discard" }));

      // Cancel means "stop editing", not "stop looking at this skill".
      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("heading", { name: "Adapt" })).toBeInTheDocument();
    });

    it("asks before throwing away unsaved edits", async () => {
      const { onClose } = await open();
      fireEvent.change(startEditing(), { target: { value: "# Edited" } });
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

      expect(onClose).not.toHaveBeenCalled();
      expect(screen.getByRole("alertdialog")).toHaveTextContent(/unsaved/i);
    });

    it("closes once the discard is confirmed", async () => {
      const { onClose } = await open();
      fireEvent.change(startEditing(), { target: { value: "# Edited" } });
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      fireEvent.click(screen.getByRole("button", { name: "Discard" }));

      expect(onClose).toHaveBeenCalled();
    });

    it("returns to the editor with the draft intact when the discard is refused", async () => {
      await open();
      fireEvent.change(startEditing(), { target: { value: "# Edited" } });
      fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
      fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(screen.getByRole("textbox", { name: /item source/i })).toHaveValue("# Edited");
    });
  });

  it("returns focus to whatever opened it", async () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const { onClose, rerender } = await open();
    expect(screen.getByRole("dialog")).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
    // The caller unmounts on close; focus has to come back with it.
    rerender(<></>);
    expect(opener).toHaveFocus();

    opener.remove();
  });

  it("keeps Tab inside the panel while it is open", async () => {
    await open();
    const panel = screen.getByRole("dialog");
    const focusable = [...panel.querySelectorAll<HTMLElement>("button, textarea, a[href]")];
    focusable[focusable.length - 1].focus();

    fireEvent.keyDown(panel, { key: "Tab" });

    expect(focusable[0]).toHaveFocus();
  });

  it("has no accessibility violations", async () => {
    const { container } = await open();
    expect(await axe(container)).toHaveNoViolations();
  });
});

/** The cases that used to be `ArtifactPanel`'s: every other kind, read-only. */
describe("ItemViewer — a non-skill item", () => {
  const MCP_JSON = '{\n  "command": "npx",\n  "env": {\n    "POSTHOG_KEY": "••••••"\n  }\n}';
  const server = (over: Partial<SetupRow> = {}): SetupRow =>
    skill({ id: 11, kind: "mcp_server", name: "posthog", path: "/Users/a/.claude.json", description: null, ...over });
  const openItem = (item = server()) => open({ item });

  beforeEach(() => {
    getArtifactSource.mockReset().mockResolvedValue(
      ok({ path: "/Users/a/.claude.json", content: MCP_JSON, bytes: 60, modified: "1", format: "json", editable: false }),
    );
  });

  it("names the artifact and says what kind it is", async () => {
    await openItem();
    expect(screen.getByRole("dialog")).toHaveAccessibleName("posthog — MCP server");
    expect(screen.getByRole("heading", { name: "posthog" })).toBeInTheDocument();
  });

  it("opens as the wide reader", async () => {
    await openItem();
    expect(screen.getByRole("dialog")).toHaveClass("sheet--wide");
  });

  it("sums up the artifact in one line, with its description under it", async () => {
    await openItem(server({ kind: "agent", name: "reviewer", description: "Reviews diffs" }));
    expect(screen.getByText("Reviews diffs")).toBeInTheDocument();
    expect(screen.getByText("Global")).toBeInTheDocument();
  });

  it("keeps the full facts behind Details, so the file comes first", async () => {
    await openItem(
      server({ usage: { total: 3, sessions: 2, last_used: null, error_rate: null, avg_turn_tokens: 900, count_30d: 0, count_prev_30d: 0 } }),
    );
    expect(screen.queryByText("Avg tokens per turn")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Details" }));
    expect(screen.getByText("Avg tokens per turn")).toBeInTheDocument();
  });

  it("shows a config excerpt verbatim as numbered source, secrets already masked", async () => {
    await openItem();
    expect(getArtifactSource).toHaveBeenCalledWith(11);
    const source = screen.getByRole("region", { name: "posthog source" });
    expect(source).toHaveTextContent('"POSTHOG_KEY": "••••••"');
    expect(source.querySelectorAll(".cv__num")).toHaveLength(6);
  });

  it("renders a markdown file as markdown, with its source a click away", async () => {
    getArtifactSource.mockResolvedValue(
      ok({ path: "/a.md", content: "# Reviewer\n\nBody.", bytes: 16, modified: "1", format: "markdown", editable: false }),
    );
    await openItem(server({ kind: "agent", name: "reviewer" }));
    expect(screen.getByRole("heading", { name: "Reviewer" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Source" }));
    expect(screen.getByRole("region", { name: "reviewer source" })).toHaveTextContent("# Reviewer");
  });

  it("shows a failed read, word for word, and reads again on request", async () => {
    getArtifactSource.mockResolvedValueOnce(err("Command get_artifact_source not allowed by ACL"));
    await openItem();
    expect(screen.getByRole("alert")).toHaveTextContent("Command get_artifact_source not allowed by ACL");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByRole("region", { name: "posthog source" })).toBeInTheDocument());
    expect(getArtifactSource).toHaveBeenCalledTimes(2);
  });

  it("offers no editing", async () => {
    await openItem();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
  });

  it("reveals and opens the file through the backend, by artifact id", async () => {
    await openItem();
    fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    fireEvent.click(screen.getByRole("button", { name: "Open in editor" }));
    await waitFor(() => expect(openArtifact).toHaveBeenCalledWith(11, "open"));
    expect(openArtifact).toHaveBeenCalledWith(11, "reveal");
  });

  it("pins a refused action to the sheet without hiding the file", async () => {
    openArtifact.mockResolvedValue(err("That file is no longer on disk."));
    await openItem();
    fireEvent.click(screen.getByRole("button", { name: "Open in editor" }));
    expect(await screen.findByText("That file is no longer on disk.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "posthog source" })).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const { onClose } = await openItem();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("has no accessibility violations", async () => {
    const { container } = await openItem();
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("ItemViewer — a graded file the inventory never saw", () => {
  const graded = skill({
    id: -42,
    kind: "rule",
    name: "AGENTS.md",
    path: "/code/web/AGENTS.md",
    description: null,
    file_id: "/code/web/AGENTS.md",
    origin: "graded",
  });

  beforeEach(() => {
    getFileDetail.mockResolvedValue(ok({ content: "# Agents\n\nBe terse.", path: "/code/web/AGENTS.md" }));
  });

  it("reads it through its file detail, not the inventory, and offers no editing", async () => {
    await open({ item: graded });
    expect(getFileDetail).toHaveBeenCalledWith("/code/web/AGENTS.md");
    expect(getArtifactSource).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Agents" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
  });

  it("reveals the file by its file id", async () => {
    await open({ item: graded });
    fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    await waitFor(() => expect(openFile).toHaveBeenCalledWith("/code/web/AGENTS.md", "reveal"));
    expect(openArtifact).not.toHaveBeenCalled();
  });
});

describe("ItemViewerView — tabs, header and stepping", () => {
  const source: ArtifactSourceState = {
    content: SOURCE,
    path: "/s/SKILL.md",
    format: "markdown",
    editable: true,
    modified: "111",
    loading: false,
    saving: false,
    error: null,
    save: vi.fn(async () => 12),
    reload: vi.fn(),
  };
  const props = {
    item: skill(),
    scope: "Global",
    source,
    tab: "content" as const,
    onTab: vi.fn(),
    loadedIn: [],
    onSelectProject: vi.fn(),
    onClose: vi.fn(),
  };

  it("opens on the requested tab and switches tabs", () => {
    const onTab = vi.fn();
    render(<ItemViewerView {...props} tab="content" onTab={onTab} />);
    expect(screen.getByRole("tablist", { name: "Viewer" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Content" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: /Findings/ }));
    expect(onTab).toHaveBeenCalledWith("findings");
  });

  it("counts the item's open findings on its tab", () => {
    render(<ItemViewerView {...props} item={skill({ issue_count: 3 })} />);
    expect(screen.getByRole("tab", { name: /Findings/ })).toHaveTextContent("Findings3");
  });

  it("shows the Usage tab's content on the Usage tab", () => {
    render(<ItemViewerView {...props} tab="usage" />);
    expect(screen.getByTestId("item-usage")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Adapt" })).toBeNull();
  });

  it("offers Edit only when the backend says the file is editable", () => {
    const { rerender } = render(<ItemViewerView {...props} source={{ ...source, editable: false }} />);
    expect(screen.queryByRole("button", { name: /Edit/ })).toBeNull();
    rerender(<ItemViewerView {...props} source={{ ...source, editable: true }} />);
    expect(screen.getByRole("button", { name: /Edit/ })).toBeInTheDocument();
  });

  it("offers Edit on the Content tab only", () => {
    render(<ItemViewerView {...props} tab="findings" />);
    expect(screen.queryByRole("button", { name: /Edit/ })).toBeNull();
  });

  it("says how many projects load it, when more than one does", () => {
    const loadedIn = [
      { path: "/code/web", name: "web" },
      { path: "/code/api", name: "api" },
    ];
    render(<ItemViewerView {...props} item={skill({ kind: "rule", name: "CLAUDE.md" })} loadedIn={loadedIn} />);
    expect(screen.getByText("loaded in 2 projects")).toBeInTheDocument();
  });

  it("steps to the next and previous item with ⌘↓ and ⌘↑", () => {
    const onStep = vi.fn();
    render(<ItemViewerView {...props} onStep={onStep} />);
    fireEvent.keyDown(window, { key: "ArrowDown", metaKey: true });
    fireEvent.keyDown(window, { key: "ArrowUp", metaKey: true });
    expect(onStep.mock.calls).toEqual([[1], [-1]]);
  });

  it("leaves a bare arrow alone", () => {
    const onStep = vi.fn();
    render(<ItemViewerView {...props} onStep={onStep} />);
    fireEvent.keyDown(window, { key: "ArrowDown" });
    expect(onStep).not.toHaveBeenCalled();
  });

  it("leaves ⌘↑/⌘↓ to a text field that has focus, such as the find bar", () => {
    const onStep = vi.fn();
    render(<ItemViewerView {...props} onStep={onStep} />);
    const field = document.createElement("input");
    document.body.appendChild(field);
    fireEvent.keyDown(field, { key: "ArrowDown", metaKey: true });
    field.remove();
    expect(onStep).not.toHaveBeenCalled();
  });

  it("steps with the Previous and Next buttons", () => {
    const onStep = vi.fn();
    render(<ItemViewerView {...props} onStep={onStep} />);
    fireEvent.click(screen.getByRole("button", { name: "Next item" }));
    fireEvent.click(screen.getByRole("button", { name: "Previous item" }));
    expect(onStep.mock.calls).toEqual([[1], [-1]]);
  });

  it("has no step buttons when there is nowhere to step", () => {
    render(<ItemViewerView {...props} />);
    expect(screen.queryByRole("button", { name: "Next item" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous item" })).toBeNull();
  });

  it("does not step while editing, so the editor keeps ⌘↑/⌘↓ and the draft is safe", () => {
    const onStep = vi.fn();
    render(<ItemViewerView {...props} onStep={onStep} initialMode="edit" />);
    fireEvent.keyDown(window, { key: "ArrowDown", metaKey: true });
    expect(onStep).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Next item" })).toBeDisabled();
  });

  it("a finding's line link switches to Content, which shows that line in Source", () => {
    const onTab = vi.fn();
    const rule = { ...props.item, kind: "rule" as const, file_id: "/x/CLAUDE.md" };
    const { rerender } = render(<ItemViewerView {...props} tab="findings" onTab={onTab} item={rule} />);
    fireEvent.click(screen.getByRole("button", { name: "jump" }));
    expect(onTab).toHaveBeenCalledWith("content");
    // jsdom has no layout, so the focused line's scroll is stubbed for this case.
    const original = Element.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      rerender(<ItemViewerView {...props} tab="content" onTab={onTab} item={rule} />);
      const region = screen.getByRole("region", { name: /source/i });
      expect(region.querySelector(".cv__line--focus")).toHaveTextContent("name: adapt");
      expect(scrollIntoView).toHaveBeenCalledWith({ block: "center" });
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it("a line jump is one-shot: the reader can go back to Rendered", () => {
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = vi.fn();
    try {
      const onTab = vi.fn();
      const rule = { ...props.item, kind: "rule" as const, file_id: "/x/CLAUDE.md" };
      const { rerender } = render(<ItemViewerView {...props} tab="findings" onTab={onTab} item={rule} />);
      fireEvent.click(screen.getByRole("button", { name: "jump" }));
      rerender(<ItemViewerView {...props} tab="content" onTab={onTab} item={rule} />);
      expect(screen.getByRole("region", { name: /source/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Rendered" }));
      expect(screen.getByRole("heading", { name: "Adapt" })).toBeInTheDocument();
      expect(screen.queryByRole("region", { name: /source/i })).toBeNull();
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it("holds the Findings and Usage tabs while a draft is open, so it cannot hide behind them", () => {
    const onTab = vi.fn();
    render(<ItemViewerView {...props} onTab={onTab} />);
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(screen.getByRole("tab", { name: /Findings/ })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Usage" })).toBeDisabled();
    fireEvent.click(screen.getByRole("tab", { name: "Usage" }));
    expect(onTab).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("tab", { name: "Usage" })).toBeEnabled();
  });

  it("has no accessibility violations with the step buttons and tabs", async () => {
    const { container } = render(<ItemViewerView {...props} onStep={vi.fn()} tab="findings" />);
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("ItemViewer — a fix landed from the Findings tab", () => {
  it("re-reads the file, so Content shows the fixed text and a later save carries the new stamp", async () => {
    const onSaved = vi.fn();
    const rule = skill({ kind: "rule", name: "CLAUDE.md", path: "/code/web/CLAUDE.md", file_id: "/code/web/CLAUDE.md" });
    const props = { item: rule, onSaved, onTab: vi.fn(), onClose: vi.fn(), loadedIn: [], onSelectProject: vi.fn(), scope: "web" };
    getArtifactSource.mockReset().mockResolvedValueOnce(
      ok({ path: rule.path, content: "# Before\n\nRun npm.", bytes: 20, modified: "111", format: "markdown", editable: true }),
    );
    const { rerender } = render(<ItemViewer {...props} tab="findings" />);
    await waitFor(() => expect(getArtifactSource).toHaveBeenCalledTimes(1));

    getArtifactSource.mockResolvedValueOnce(
      ok({ path: rule.path, content: "# After\n\nRun pnpm.", bytes: 21, modified: "222", format: "markdown", editable: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: "fix landed" }));
    expect(onSaved).toHaveBeenCalledOnce();
    await waitFor(() => expect(getArtifactSource).toHaveBeenCalledTimes(2));

    rerender(<ItemViewer {...props} tab="content" />);
    expect(await screen.findByRole("heading", { name: "After" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "# Mine" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saveArtifactSource).toHaveBeenCalledWith(7, "# Mine", "222"));
  });
});

describe("ItemViewer — a file that changed on disk under the viewer (Review Focus 5)", () => {
  // Modelled on useArtifactSource.test.ts:176: the save is refused with the
  // conflict marker, the viewer re-reads, keeps the user's draft and says why.
  it.each([
    ["an agent", { kind: "agent" as const, name: "reviewer", path: "/Users/a/.claude/agents/reviewer.md" }],
    ["an instruction file", { kind: "rule" as const, name: "CLAUDE.md", path: "/code/web/CLAUDE.md" }],
  ])("refuses the save for %s, reloads, and keeps the draft", async (_label, over) => {
    getArtifactSource.mockReset();
    getArtifactSource.mockResolvedValueOnce(
      ok({ path: over.path, content: "old", bytes: 3, modified: "111", format: "markdown", editable: true }),
    );
    saveArtifactSource.mockResolvedValueOnce(err("That file changed on disk since you opened it."));
    await open({ item: skill(over) });
    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "mine" } });
    getArtifactSource.mockResolvedValueOnce(
      ok({ path: over.path, content: "theirs", bytes: 6, modified: "222", format: "markdown", editable: true }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/changed on disk/)).toBeInTheDocument();
    expect(saveArtifactSource).toHaveBeenCalledWith(expect.anything(), "mine", "111");
    await waitFor(() => expect(getArtifactSource).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("textbox")).toHaveValue("mine");
  });

  it("keeps a .cursorrules file read-only", async () => {
    getArtifactSource.mockReset().mockResolvedValue(
      ok({ path: "/code/web/.cursorrules", content: "be terse", bytes: 8, modified: "1", format: "text", editable: false }),
    );
    await open({ item: skill({ kind: "rule", name: ".cursorrules", path: "/code/web/.cursorrules" }) });
    expect(screen.getByText("be terse")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit/ })).toBeNull();
  });
});
