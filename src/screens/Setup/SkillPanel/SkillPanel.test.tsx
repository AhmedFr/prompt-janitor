import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { ArtifactView } from "@/lib/ipc";

const getArtifactSource = vi.hoisted(() => vi.fn());
const saveArtifactSource = vi.hoisted(() => vi.fn());
const openArtifact = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, isTauri: true, commands: { getArtifactSource, saveArtifactSource, openArtifact } };
});

import { SkillPanel } from "./index";

const ok = <T,>(data: T) => ({ status: "ok" as const, data });
const err = (error: string) => ({ status: "error" as const, error });

const SOURCE = ["---", "name: adapt", "description: Adapts designs", "---", "# Adapt", "", "Body text."].join("\n");

const skill = (over: Partial<ArtifactView> = {}): ArtifactView => ({
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
  usage: null,
  ...over,
});

/** Renders the panel and waits for the initial read to land. */
async function open(props: Partial<Parameters<typeof SkillPanel>[0]> = {}) {
  const onClose = vi.fn();
  const view = render(<SkillPanel skill={skill()} scope="Global" onClose={onClose} {...props} />);
  await waitFor(() => expect(screen.queryByText("Reading adapt…")).not.toBeInTheDocument());
  return { ...view, onClose };
}

beforeEach(() => {
  getArtifactSource
    .mockReset()
    .mockResolvedValue(ok({ path: "/s/SKILL.md", content: SOURCE, bytes: 64, modified: "111", format: "markdown", editable: true }));
  saveArtifactSource.mockReset().mockResolvedValue(ok({ bytes: 12 }));
  openArtifact.mockReset().mockResolvedValue(ok(null));
});

afterEach(cleanup);

describe("SkillPanel", () => {
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
    render(<SkillPanel skill={skill()} scope="Global" onClose={vi.fn()} />);
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
      return screen.getByRole("textbox", { name: /markdown/i });
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
      expect(screen.getByRole("textbox", { name: /markdown/i })).toHaveValue("# Edited");
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
      expect(screen.getByRole("textbox", { name: /markdown/i })).toHaveValue("# Edited");
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
