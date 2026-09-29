import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
vi.mock("../AppTab", () => ({ AppTab: () => <div data-testid="app-tab" /> }));
import { AboutTab } from "./AboutTab";

describe("AboutTab", () => {
  it("shows the storage path and the version/updates/danger block together", () => {
    render(
      <AboutTab
        status={{ schema_version: 9, db_path: "/Users/a/pj.db", project_count: 3, file_count: 12 } as never}
      />,
    );
    expect(screen.getByText("/Users/a/pj.db")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByTestId("app-tab")).toBeInTheDocument();
  });
});
