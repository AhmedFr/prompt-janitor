import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup, screen } from "@testing-library/react";
import { axe } from "vitest-axe";
import { MissingFolderBanner } from "./MissingFolderBanner";

afterEach(cleanup);

describe("MissingFolderBanner", () => {
  it("announces itself rather than waiting to be noticed", () => {
    render(<MissingFolderBanner />);
    expect(screen.getByRole("status")).toHaveTextContent(/Folder missing from disk/);
  });

  it("says the numbers below it are the last scan's, not today's", () => {
    render(<MissingFolderBanner />);
    expect(screen.getByText(/what the last scan saw/)).toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<MissingFolderBanner />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
