import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { axe } from "vitest-axe";

const openArtifact = vi.hoisted(() => vi.fn());
const copyText = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, isTauri: true, commands: { openArtifact } };
});
vi.mock("@/lib/clipboard", () => ({ copyText }));

import { FileActions } from "./index";

beforeEach(() => {
  openArtifact.mockReset().mockResolvedValue({ status: "ok", data: null });
  copyText.mockReset().mockResolvedValue(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("FileActions", () => {
  it("reveals the artifact's file in Finder by id, never by path", async () => {
    render(<FileActions artifactId={7} content="x" onError={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Reveal in Finder" }));
    await waitFor(() => expect(openArtifact).toHaveBeenCalledWith(7, "reveal"));
  });

  it("opens the file in its default app", async () => {
    render(<FileActions artifactId={7} content="x" onError={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Open in editor" }));
    await waitFor(() => expect(openArtifact).toHaveBeenCalledWith(7, "open"));
  });

  it("reports a refused open instead of doing nothing", async () => {
    openArtifact.mockResolvedValue({ status: "error", error: "That file is no longer on disk." });
    const onError = vi.fn();
    render(<FileActions artifactId={7} content="x" onError={onError} />);
    fireEvent.click(screen.getByRole("button", { name: "Open in editor" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("That file is no longer on disk."));
  });

  it("copies the contents it was shown and says so", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<FileActions artifactId={7} content={"# Adapt\n"} onError={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy file contents" }));
    await waitFor(() => expect(copyText).toHaveBeenCalledWith("# Adapt\n"));
    expect(await screen.findByText("Copied")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText("Copied")).toBeNull();
  });

  it("reports a failed copy", async () => {
    copyText.mockResolvedValue(false);
    const onError = vi.fn();
    render(<FileActions artifactId={7} content="x" onError={onError} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy file contents" }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith("Couldn't copy the file to the clipboard."));
  });

  it("cannot copy before the file is read", () => {
    render(<FileActions artifactId={7} content={null} onError={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Copy file contents" })).toBeDisabled();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<FileActions artifactId={7} content="x" onError={vi.fn()} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
