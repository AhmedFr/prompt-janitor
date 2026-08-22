import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup, screen, fireEvent } from "@testing-library/react";
import { DataTableSearch } from "./DataTableSearch";
import { SEARCH_DEBOUNCE_MS } from "./DataTable.constants";

afterEach(cleanup);

describe("DataTableSearch", () => {
  it("keeps a keystroke that races the debounce commit", () => {
    vi.useFakeTimers();
    try {
      const onCommit = vi.fn();
      const { rerender } = render(
        <DataTableSearch placeholder="Search" value="" onCommit={onCommit} resetKey="k" />,
      );
      const input = screen.getByRole("searchbox");

      fireEvent.change(input, { target: { value: "brav" } });
      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS);
      expect(onCommit).toHaveBeenCalledWith("brav");

      // The user keeps typing before the parent has re-rendered with the
      // committed value — the commit and the next keystroke race.
      fireEvent.change(input, { target: { value: "bravo" } });

      // The parent re-renders with the value it just committed, arriving
      // after the extra keystroke.
      rerender(<DataTableSearch placeholder="Search" value="brav" onCommit={onCommit} resetKey="k" />);

      expect(input).toHaveValue("bravo");
    } finally {
      vi.useRealTimers();
    }
  });
});
