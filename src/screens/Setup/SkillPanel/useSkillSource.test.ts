import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const getArtifactSource = vi.hoisted(() => vi.fn());
const saveArtifactSource = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return { ...actual, commands: { getArtifactSource, saveArtifactSource } };
});

import { useSkillSource } from "./useSkillSource";

const ok = <T,>(data: T) => ({ status: "ok" as const, data });
const err = (error: string) => ({ status: "error" as const, error });

beforeEach(() => {
  getArtifactSource.mockReset();
  saveArtifactSource.mockReset();
});

afterEach(() => vi.restoreAllMocks());

describe("useSkillSource", () => {
  it("reads the artifact's file on mount", async () => {
    getArtifactSource.mockResolvedValue(ok({ path: "/s/SKILL.md", content: "# a", bytes: 3 }));

    const { result } = renderHook(() => useSkillSource(7));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(getArtifactSource).toHaveBeenCalledWith(7);
    expect(result.current.content).toBe("# a");
    expect(result.current.path).toBe("/s/SKILL.md");
    expect(result.current.error).toBeNull();
  });

  it("surfaces a failed read as an error rather than empty content", async () => {
    getArtifactSource.mockResolvedValue(err("Couldn't read the file: nope"));

    const { result } = renderHook(() => useSkillSource(7));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Couldn't read the file: nope");
    expect(result.current.content).toBeNull();
  });

  it("re-reads when it is pointed at a different artifact", async () => {
    getArtifactSource.mockResolvedValue(ok({ path: "/a", content: "a", bytes: 1 }));
    const { result, rerender } = renderHook(({ id }) => useSkillSource(id), {
      initialProps: { id: 1 },
    });
    await waitFor(() => expect(result.current.content).toBe("a"));

    getArtifactSource.mockResolvedValue(ok({ path: "/b", content: "b", bytes: 1 }));
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
    const { result, rerender } = renderHook(({ id }) => useSkillSource(id), {
      initialProps: { id: 1 },
    });

    getArtifactSource.mockResolvedValueOnce(ok({ path: "/b", content: "second", bytes: 6 }));
    rerender({ id: 2 });
    await waitFor(() => expect(result.current.content).toBe("second"));

    await act(async () => {
      settleFirst(ok({ path: "/a", content: "first", bytes: 5 }));
    });

    expect(result.current.content).toBe("second");
  });

  it("saves the edited text and adopts it as the on-disk content", async () => {
    getArtifactSource.mockResolvedValue(ok({ path: "/s", content: "old", bytes: 3 }));
    saveArtifactSource.mockResolvedValue(ok({ bytes: 3 }));
    const { result } = renderHook(() => useSkillSource(7));
    await waitFor(() => expect(result.current.content).toBe("old"));

    let landed: number | null | undefined;
    await act(async () => {
      landed = await result.current.save("new");
    });

    expect(saveArtifactSource).toHaveBeenCalledWith(7, "new");
    // The byte count comes back from Rust rather than being measured here:
    // `content.length` counts UTF-16 units, and the Size column means bytes.
    expect(landed).toBe(3);
    expect(result.current.content).toBe("new");
    expect(result.current.error).toBeNull();
  });

  it("reports a failed save and leaves the on-disk content untouched", async () => {
    getArtifactSource.mockResolvedValue(ok({ path: "/s", content: "old", bytes: 3 }));
    saveArtifactSource.mockResolvedValue(err("That file is no longer on disk."));
    const { result } = renderHook(() => useSkillSource(7));
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
    getArtifactSource.mockResolvedValue(ok({ path: "/s", content: "old", bytes: 3 }));
    saveArtifactSource.mockResolvedValueOnce(err("boom"));
    saveArtifactSource.mockResolvedValueOnce(ok({ bytes: 3 }));
    const { result } = renderHook(() => useSkillSource(7));
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
