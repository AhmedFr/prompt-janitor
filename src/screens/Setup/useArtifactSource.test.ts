import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const getArtifactSource = vi.hoisted(() => vi.fn());
const saveArtifactSource = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, commands: { getArtifactSource, saveArtifactSource } };
});

import { useArtifactSource } from "./useArtifactSource";

const ok = <T,>(data: T) => ({ status: "ok" as const, data });
const err = (error: string) => ({ status: "error" as const, error });

beforeEach(() => {
  getArtifactSource.mockReset();
  saveArtifactSource.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe("useArtifactSource", () => {
  it("reads the artifact's file on mount", async () => {
    getArtifactSource.mockResolvedValue(ok({ path: "/s/SKILL.md", content: "# a", bytes: 3, modified: "111" }));

    const { result } = renderHook(() => useArtifactSource(7));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getArtifactSource).toHaveBeenCalledWith(7);
    expect(result.current.content).toBe("# a");
    expect(result.current.path).toBe("/s/SKILL.md");
    expect(result.current.error).toBeNull();
  });

  it("carries how to draw the file and whether it may be edited", async () => {
    getArtifactSource.mockResolvedValue(
      ok({ path: "/.mcp.json", content: "{}", bytes: 2, modified: "1", format: "json", editable: false }),
    );

    const { result } = renderHook(() => useArtifactSource(7));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.format).toBe("json");
    expect(result.current.editable).toBe(false);
  });

  it("reads the file again on reload, clearing the previous error", async () => {
    getArtifactSource.mockResolvedValueOnce(err("Command get_artifact_source not allowed by ACL"));
    getArtifactSource.mockResolvedValueOnce(ok({ path: "/s/SKILL.md", content: "# a", bytes: 3, modified: "1" }));

    const { result } = renderHook(() => useArtifactSource(7));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    act(() => result.current.reload());
    await waitFor(() => expect(result.current.content).toBe("# a"));
    expect(result.current.error).toBeNull();
    expect(getArtifactSource).toHaveBeenCalledTimes(2);
  });

  it("assumes nothing is editable before a read lands", () => {
    getArtifactSource.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useArtifactSource(7));
    expect(result.current.editable).toBe(false);
    expect(result.current.format).toBeNull();
  });

  it("surfaces a failed read as an error rather than empty content", async () => {
    getArtifactSource.mockResolvedValue(err("Couldn't read the file: nope"));

    const { result } = renderHook(() => useArtifactSource(7));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Couldn't read the file: nope");
    expect(result.current.content).toBeNull();
  });

  it("re-reads when it is pointed at a different artifact", async () => {
    getArtifactSource.mockResolvedValue(ok({ path: "/a", content: "a", bytes: 1, modified: "111" }));
    const { result, rerender } = renderHook(({ id }) => useArtifactSource(id), {
      initialProps: { id: 1 },
    });
    await waitFor(() => expect(result.current.content).toBe("a"));

    getArtifactSource.mockResolvedValue(ok({ path: "/b", content: "b", bytes: 1, modified: "222" }));
    rerender({ id: 2 });

    await waitFor(() => expect(result.current.content).toBe("b"));
    expect(getArtifactSource).toHaveBeenLastCalledWith(2);
  });

  /**
   * Two reads in flight at once — a fast second click while the first is still
   * loading — must not let the slower, older one land last and show the wrong
   * skill's text.
   */
  it("ignores a read that resolves after it has moved to another artifact", async () => {
    let settleFirst: (v: unknown) => void = () => {};
    getArtifactSource.mockReturnValueOnce(new Promise((r) => (settleFirst = r)));
    const { result, rerender } = renderHook(({ id }) => useArtifactSource(id), {
      initialProps: { id: 1 },
    });

    getArtifactSource.mockResolvedValueOnce(ok({ path: "/b", content: "second", bytes: 6, modified: "222" }));
    rerender({ id: 2 });
    await waitFor(() => expect(result.current.content).toBe("second"));

    await act(async () => {
      settleFirst(ok({ path: "/a", content: "first", bytes: 5, modified: "111" }));
    });

    expect(result.current.content).toBe("second");
  });

  it("saves the edited text and adopts it as the on-disk content", async () => {
    getArtifactSource.mockResolvedValue(ok({ path: "/s", content: "old", bytes: 3, modified: "111" }));
    saveArtifactSource.mockResolvedValue(ok({ bytes: 3 }));
    const { result } = renderHook(() => useArtifactSource(7));
    await waitFor(() => expect(result.current.content).toBe("old"));

    let landed: number | null | undefined;
    await act(async () => {
      landed = await result.current.save("new");
    });

    // The stamp from the read travels back, so Rust can refuse a save over a
    // file something else has changed in the meantime.
    expect(saveArtifactSource).toHaveBeenCalledWith(7, "new", "111");
    // The byte count comes back from Rust rather than being measured here:
    // `content.length` counts UTF-16 units, and the Size column means bytes.
    expect(landed).toBe(3);
    expect(result.current.content).toBe("new");
    expect(result.current.error).toBeNull();
  });

  it("reports a failed save and leaves the on-disk content untouched", async () => {
    getArtifactSource.mockResolvedValue(ok({ path: "/s", content: "old", bytes: 3, modified: "111" }));
    saveArtifactSource.mockResolvedValue(err("That file is no longer on disk."));
    const { result } = renderHook(() => useArtifactSource(7));
    await waitFor(() => expect(result.current.content).toBe("old"));

    let landed: number | null | undefined;
    await act(async () => {
      landed = await result.current.save("new");
    });

    expect(landed).toBeNull();
    expect(result.current.error).toBe("That file is no longer on disk.");
    expect(result.current.content).toBe("old");
  });

  it("clears a previous error once a save succeeds", async () => {
    getArtifactSource.mockResolvedValue(ok({ path: "/s", content: "old", bytes: 3, modified: "111" }));
    saveArtifactSource.mockResolvedValueOnce(err("boom"));
    saveArtifactSource.mockResolvedValueOnce(ok({ bytes: 3 }));
    const { result } = renderHook(() => useArtifactSource(7));
    await waitFor(() => expect(result.current.content).toBe("old"));

    await act(async () => {
      await result.current.save("new");
    });
    expect(result.current.error).toBe("boom");

    await act(async () => {
      await result.current.save("new");
    });
    expect(result.current.error).toBeNull();
  });
});

describe("useArtifactSource — a file that moved underneath the panel", () => {
  it("re-reads after a rejected save, so the next attempt carries the new stamp", async () => {
    getArtifactSource.mockResolvedValueOnce(
      ok({ path: "/s", content: "old", bytes: 3, modified: "111" }),
    );
    saveArtifactSource.mockResolvedValueOnce(err("That file changed on disk since you opened it."));
    const { result } = renderHook(() => useArtifactSource(7));
    await waitFor(() => expect(result.current.content).toBe("old"));

    getArtifactSource.mockResolvedValueOnce(
      ok({ path: "/s", content: "theirs", bytes: 6, modified: "222" }),
    );
    await act(async () => {
      await result.current.save("mine");
    });

    // The panel now holds what is actually on disk, and says why.
    await waitFor(() => expect(result.current.content).toBe("theirs"));
    expect(result.current.error).toContain("changed on disk");
  });

  it("does not re-read after an ordinary save failure", async () => {
    getArtifactSource.mockResolvedValue(ok({ path: "/s", content: "old", bytes: 3, modified: "111" }));
    saveArtifactSource.mockResolvedValue(err("That file is no longer on disk."));
    const { result } = renderHook(() => useArtifactSource(7));
    await waitFor(() => expect(result.current.content).toBe("old"));
    const reads = getArtifactSource.mock.calls.length;

    await act(async () => {
      await result.current.save("mine");
    });

    expect(getArtifactSource.mock.calls.length).toBe(reads);
    expect(result.current.content).toBe("old");
  });
});
