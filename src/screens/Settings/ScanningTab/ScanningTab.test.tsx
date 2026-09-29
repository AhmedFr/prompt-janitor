import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ScanningTab } from "./ScanningTab";

describe("ScanningTab", () => {
  it("marks the current frequency and reports a pick", () => {
    const onChange = vi.fn();
    render(<ScanningTab schedule="6h" onChange={onChange} />);
    expect(screen.getByRole("radio", { name: /Every 6 hours/ })).toBeChecked();
    fireEvent.click(screen.getByRole("radio", { name: /Once a day/ }));
    expect(onChange).toHaveBeenCalledWith("1d");
  });
});
