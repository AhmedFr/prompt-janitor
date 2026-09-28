import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
vi.mock("@/lib/ipc", async () => ({ ...(await vi.importActual<object>("@/lib/ipc")), isTauri: true }));
vi.mock("./useSettings", () => ({
  useSettings: () => ({ loading: false, schedule: "6h", digest: true, regressions: true, status: null,
    ai: null, setSchedule: vi.fn(), setDigest: vi.fn(), setRegressions: vi.fn(), saveAi: vi.fn(), testAi: vi.fn() }),
}));
vi.mock("./FoldersTab", () => ({ FoldersTab: () => <div data-testid="folders" /> }));
vi.mock("./ChecksTab", () => ({
  ChecksTab: ({ initialTab }: { initialTab?: string }) => <div data-testid="checks">{initialTab ?? "none"}</div>,
}));
vi.mock("./AboutTab", () => ({ AboutTab: () => <div data-testid="about" /> }));
import { Settings } from "./Settings";

describe("Settings", () => {
  afterEach(cleanup);

  it("offers the six tabs and no License tab", () => {
    render(<Settings navigate={vi.fn()} />);
    for (const label of ["Folders", "Scanning", "Notifications", "Checks", "AI", "About"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.queryByRole("button", { name: "License" })).toBeNull();
  });

  it("opens an old deep link on the tab that replaced it", () => {
    render(<Settings navigate={vi.fn()} initialTab="app" />);
    expect(screen.getByTestId("about")).toBeInTheDocument();
  });

  it("shows the folder list under the Folders tab", () => {
    render(<Settings navigate={vi.fn()} initialTab="harnesses" />);
    expect(screen.getByTestId("folders")).toBeInTheDocument();
  });

  it("passes the rule table through to the Checks tab", () => {
    render(<Settings navigate={vi.fn()} initialTab="checks" checksTab="custom" />);
    expect(screen.getByTestId("checks")).toHaveTextContent("custom");
  });
});
