import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Sheet, SheetPath } from "./index";

afterEach(cleanup);

function renderSheet(props: Partial<Parameters<typeof Sheet>[0]> = {}) {
  const onClose = vi.fn();
  const view = render(
    <Sheet title="posthog" onClose={onClose} {...props}>
      <p>Body</p>
    </Sheet>,
  );
  return { ...view, onClose };
}

describe("Sheet", () => {
  it("is a modal dialog named after its title", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("posthog");
    expect(screen.getByRole("heading", { name: "posthog" })).toBeInTheDocument();
  });

  it("takes an explicit accessible name when the title alone is ambiguous", () => {
    renderSheet({ ariaLabel: "posthog — MCP server" });
    expect(screen.getByRole("dialog")).toHaveAccessibleName("posthog — MCP server");
  });

  it("renders its body, subtitle, toolbar and footer slots", () => {
    renderSheet({
      subtitle: <span>MCP server</span>,
      toolbar: <span>toolbar</span>,
      footer: <span>footer</span>,
    });
    for (const text of ["Body", "MCP server", "toolbar", "footer"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
  });

  it("pins an error as an alert, and draws none without one", () => {
    const { rerender } = render(
      <Sheet title="x" onClose={() => {}} error={null}>
        <p>Body</p>
      </Sheet>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    rerender(
      <Sheet title="x" onClose={() => {}} error="Couldn't read the file.">
        <p>Body</p>
      </Sheet>,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't read the file.");
  });

  it("closes on the close button", () => {
    const { onClose } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on Escape", () => {
    const { onClose } = renderSheet();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on a press on the backdrop, not on one inside the panel", () => {
    const { onClose, container } = renderSheet();
    fireEvent.mouseDown(screen.getByText("Body"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.mouseDown(container.querySelector(".sheet-scrim")!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("takes focus on open and hands it back to the opener on close", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();

    const { unmount } = renderSheet();
    expect(screen.getByRole("dialog")).toHaveFocus();
    unmount();
    expect(opener).toHaveFocus();
    opener.remove();
  });

  it("keeps Tab inside the panel", () => {
    renderSheet({ footer: <button>Last</button> });
    const close = screen.getByRole("button", { name: "Close" });
    const last = screen.getByRole("button", { name: "Last" });

    last.focus();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("is the narrow drawer by default and a wide reader on request", () => {
    const { unmount } = renderSheet();
    expect(screen.getByRole("dialog")).not.toHaveClass("sheet--wide");
    unmount();
    renderSheet({ size: "wide" });
    expect(screen.getByRole("dialog")).toHaveClass("sheet--wide");
  });

  it("pads and scrolls its body unless the body scrolls itself", () => {
    // A file viewer keeps its own bar fixed and scrolls only the text, so it
    // asks for a flush body the sheet does not scroll.
    const { container, unmount } = renderSheet();
    expect(container.querySelector(".sheet__body")).not.toHaveClass("sheet__body--flush");
    unmount();
    const flush = renderSheet({ flush: true });
    expect(flush.container.querySelector(".sheet__body")).toHaveClass("sheet__body--flush");
  });

  it("has no accessibility violations", async () => {
    const { container } = renderSheet({ toolbar: <SheetPath path="/a/b.json" /> });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("SheetPath", () => {
  it("shows the path, isolated from its truncating box's direction", () => {
    render(<SheetPath path="/Users/a/.mcp.json" />);
    // Without the isolate the leading slash renders at the end.
    expect(screen.getByText("/Users/a/.mcp.json").tagName).toBe("BDI");
  });

  it("puts the file's actions beside the path", () => {
    render(<SheetPath path="/a/b.json" actions={<button type="button">Reveal</button>} />);
    expect(screen.getByRole("button", { name: "Reveal" })).toBeInTheDocument();
  });

  it("has no action of its own", () => {
    // It used to carry an "Open" that handed the path to the opener plugin's
    // `openUrl`, which the default permission set refuses for a file path —
    // the button silently did nothing. Actions come from the caller now.
    render(<SheetPath path="/a/b.json" />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
