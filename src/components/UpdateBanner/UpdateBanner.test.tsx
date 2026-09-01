import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup, fireEvent } from "@testing-library/react";
import { axe } from "vitest-axe";
import { UpdateBanner } from "./UpdateBanner";

afterEach(cleanup);

describe("UpdateBanner", () => {
  it("names the version on offer", () => {
    const { getByText } = render(
      <UpdateBanner version="0.1.1" onOpen={() => {}} onDismiss={() => {}} />,
    );
    expect(getByText(/Prompt Janitor 0\.1\.1 is available/)).toBeInTheDocument();
  });

  it("routes to the Settings App tab", () => {
    const onOpen = vi.fn();
    const { getByRole } = render(
      <UpdateBanner version="0.1.1" onOpen={onOpen} onDismiss={() => {}} />,
    );
    fireEvent.click(getByRole("button", { name: "Open Settings" }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("can be waved away", () => {
    const onDismiss = vi.fn();
    const { getByRole } = render(
      <UpdateBanner version="0.1.1" onOpen={() => {}} onDismiss={onDismiss} />,
    );
    fireEvent.click(getByRole("button", { name: "Dismiss update notice" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("announces the sentence, not the buttons, as the live region", () => {
    const { getByRole } = render(
      <UpdateBanner version="0.1.1" onOpen={() => {}} onDismiss={() => {}} />,
    );
    const live = getByRole("status");
    expect(live).toHaveTextContent("Prompt Janitor 0.1.1 is available");
    // A live region wrapping the controls would re-announce them on change.
    expect(live.querySelector("button")).toBeNull();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <UpdateBanner version="0.1.1" onOpen={() => {}} onDismiss={() => {}} />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
