import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
vi.mock("./ChecksLibrary", () => ({
  ChecksLibrary: ({ onAdd, initialTab }: { onAdd: (tab: string) => void; initialTab?: string }) => (
    <div>
      <span>library on {initialTab ?? "default"}</span>
      <button onClick={() => onAdd("custom")}>Add check</button>
    </div>
  ),
}));
vi.mock("./AddCheck", () => ({
  AddCheck: ({ onDone, initialType }: { onDone: (tab: string) => void; initialType?: string }) => (
    <div>
      <span>form for {initialType}</span>
      <button onClick={() => onDone("custom")}>Save check</button>
    </div>
  ),
}));
import { ChecksTab } from "./ChecksTab";

describe("ChecksTab", () => {
  afterEach(cleanup);

  it("opens the add form in place and returns to the library when it is done", () => {
    render(<ChecksTab />);
    fireEvent.click(screen.getByRole("button", { name: "Add check" }));
    expect(screen.getByText("form for custom")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save check" }));
    expect(screen.getByRole("button", { name: "Add check" })).toBeInTheDocument();
    expect(screen.getByText("library on custom")).toBeInTheDocument();
  });

  it("opens the library on the rule table a deep link named", () => {
    render(<ChecksTab initialTab="ai" />);
    expect(screen.getByText("library on ai")).toBeInTheDocument();
  });

  it("follows a new deep link while mounted", () => {
    const { rerender } = render(<ChecksTab initialTab="builtin" />);
    rerender(<ChecksTab initialTab="custom" />);
    expect(screen.getByText("library on custom")).toBeInTheDocument();
  });
});
