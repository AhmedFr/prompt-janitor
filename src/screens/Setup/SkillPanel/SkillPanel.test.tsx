import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";
import type { ArtifactView } from "@/lib/ipc";

const getArtifactSource = vi.hoisted(() => vi.fn());
const saveArtifactSource = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, commands: { getArtifactSource, saveArtifactSource } };
});

const openExternal = vi.hoisted(() => vi.fn());
vi.mock("@/lib/open-external", () => ({ openExternal }));

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
  const view = render(<SkillPanel skill={skill()} onClose={onClose} {...props} />);
  await waitFor(() => expect(screen.queryByText("Loading…")).not.toBeInTheDocument());
  return { ...view, onClose };
}

beforeEach(() => {
  getArtifactSource.mockReset().mockResolvedValue(ok({ path: "/s/SKILL.md", content: SOURCE, bytes: 64 }));
  saveArtifactSource.mockReset().mockResolvedValue(ok({ bytes: 12 }));
  openExternal.mockReset();
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
    render(<SkillPanel skill={skill()} onClose={vi.fn()} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows a failed read instead of an empty document", async () => {
    getArtifactSource.mockResolvedValue(err("Couldn't read the file: nope"));
    await open();
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't read the file: nope");
  });

  it("opens the file in Finder on request", async () => {
    await open();
    fireEvent.click(screen.getByRole("button", { name: /reveal/i }));
    expect(openExternal).toHaveBeenCalledWith("/s/SKILL.md");
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

    it("puts the raw file — frontmatter included — into the editor", async () => {
      await open();
      expect(startEditing()).toHaveValue(SOURCE);
    });

    it("saves the edited text and returns to reading it", async () => {
      await open();
      fireEvent.change(startEditing(), { target: { value: "# Edited" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(saveArtifactSource).toHaveBeenCalledWith(7, "# Edited"));
      await waitFor(() => expect(screen.getByRole("heading", { name: "Edited" })).toBeInTheDocument());
    });

    it("reports the new byte count so the table can update without a rescan", async () => {
      const onSaved = vi.fn();
      await open({ onSaved });
      fireEvent.change(startEditing(), { target: { value: "# Edited" } });
      fireEvent.click(screen.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(onSaved).toHaveBeenCalledWith(12));
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

  it("has no accessibility violations", async () => {
    const { container } = await open();
    expect(await axe(container)).toHaveNoViolations();
  });
});
