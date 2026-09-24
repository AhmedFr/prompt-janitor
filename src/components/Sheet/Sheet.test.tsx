import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";

const openExternal = vi.hoisted(() => vi.fn());
vi.mock("@/lib/open-external", () => ({ openExternal }));

import { Sheet, SheetPath } from "./index";

beforeEach(() => openExternal.mockReset());
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

  it("has no accessibility violations", async () => {
    const { container } = renderSheet({ toolbar: <SheetPath path="/a/b.json" name="b" /> });
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe("SheetPath", () => {
  it("shows the path and opens it on request", () => {
    render(<SheetPath path="/Users/a/.mcp.json" name="posthog" />);
    expect(screen.getByText("/Users/a/.mcp.json")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open posthog on disk" }));
    expect(openExternal).toHaveBeenCalledWith("/Users/a/.mcp.json");
  });
});
