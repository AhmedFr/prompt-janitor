import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { CURRENT_HIGHLIGHT, MATCH_HIGHLIGHT } from "./FindBar.constants";
import { useFind } from "./useFind";

function mount(html: string) {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.append(root);
  return { current: root };
}

afterEach(cleanup);

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useFind", () => {
  it("counts the matches and starts on the first", () => {
    const ref = mount("<p>env ENV env</p>");
    const { result } = renderHook(() => useFind(ref, "env", "k"));
    expect(result.current.count).toBe(3);
    expect(result.current.current).toBe(0);
  });

  it("has no current match when nothing matches", () => {
    const ref = mount("<p>text</p>");
    const { result } = renderHook(() => useFind(ref, "zzz", "k"));
    expect(result.current.count).toBe(0);
    expect(result.current.current).toBe(-1);
  });

  it("wraps next past the last match and previous past the first", () => {
    const ref = mount("<p>a a</p>");
    const { result } = renderHook(() => useFind(ref, "a", "k"));
    act(() => result.current.next());
    expect(result.current.current).toBe(1);
    act(() => result.current.next());
    expect(result.current.current).toBe(0);
    act(() => result.current.prev());
    expect(result.current.current).toBe(1);
  });

  it("goes back to the first match when the query changes", () => {
    const ref = mount("<p>ab ab</p>");
    const { result, rerender } = renderHook(({ q }) => useFind(ref, q, "k"), { initialProps: { q: "ab" } });
    act(() => result.current.next());
    rerender({ q: "a" });
    expect(result.current.current).toBe(0);
  });

  it("searches again when the content key changes", () => {
    const ref = mount("<p>one</p>");
    const { result, rerender } = renderHook(({ key }) => useFind(ref, "two", key), { initialProps: { key: "1" } });
    expect(result.current.count).toBe(0);
    ref.current.innerHTML = "<p>two two</p>";
    rerender({ key: "2" });
    expect(result.current.count).toBe(2);
  });

  it("works without the Custom Highlight API", () => {
    // WKWebView before macOS 14.2 has no `CSS.highlights`; find still counts
    // and moves, it just cannot paint.
    const ref = mount("<p>x x</p>");
    expect(() => renderHook(() => useFind(ref, "x", "k"))).not.toThrow();
  });

  describe("with the Custom Highlight API", () => {
    const registry = new Map<string, { size: number }>();

    beforeEach(() => {
      registry.clear();
      vi.stubGlobal(
        "Highlight",
        class {
          size = 0;
          constructor(...ranges: AbstractRange[]) {
            // Built empty and filled with `add`: spreading 100,000 matches
            // into one call throws past the engine's argument limit.
            if (ranges.length > 0) throw new Error("ranges must be added, not spread");
          }
          add() {
            this.size += 1;
            return this;
          }
        },
      );
      vi.stubGlobal("CSS", { highlights: registry });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("paints every match and, separately, the current one", () => {
      const ref = mount("<p>a a a</p>");
      renderHook(() => useFind(ref, "a", "k"));
      expect(registry.get(MATCH_HIGHLIGHT)?.size).toBe(3);
      expect(registry.get(CURRENT_HIGHLIGHT)?.size).toBe(1);
    });

    it("clears the paint when the finder goes away", () => {
      const ref = mount("<p>a</p>");
      const { unmount } = renderHook(() => useFind(ref, "a", "k"));
      unmount();
      expect(registry.has(MATCH_HIGHLIGHT)).toBe(false);
      expect(registry.has(CURRENT_HIGHLIGHT)).toBe(false);
    });
  });
});
