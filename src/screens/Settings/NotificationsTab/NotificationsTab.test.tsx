import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { NotificationsTab } from "./NotificationsTab";

describe("NotificationsTab", () => {
  it("toggles the weekly digest and the regression alert independently", () => {
    const onDigest = vi.fn();
    const onRegressions = vi.fn();
    render(<NotificationsTab digest regressions={false} onDigest={onDigest} onRegressions={onRegressions} />);
    fireEvent.click(screen.getByRole("switch", { name: /Weekly digest/ }));
    expect(onDigest).toHaveBeenCalledWith(false);
    fireEvent.click(screen.getByRole("switch", { name: /regresses a grade/ }));
    expect(onRegressions).toHaveBeenCalledWith(true);
  });
});
