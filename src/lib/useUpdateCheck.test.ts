import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

const check = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/plugin-updater", () => ({ check }));

const tauri = vi.hoisted(() => ({ value: true }));
vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return {
    ...actual,
    get isTauri() {
      return tauri.value;
    },
  };
});

const panel = vi.hoisted(() => ({ value: false }));
vi.mock("@/lib/window-kind", () => ({ isPanelWindow: () => panel.value }));

import { useUpdateCheck, UPDATE_CHECK_DELAY_MS, UPDATE_DISMISSED_KEY } from "./useUpdateCheck";

/** Advance past the launch delay and let the check's promise settle. */
const runCheck = async () => {
  await act(async () => {
    vi.advanceTimersByTime(UPDATE_CHECK_DELAY_MS);
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  check.mockReset();
  tauri.value = true;
  panel.value = false;
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useUpdateCheck", () => {
  it("does not check before the launch delay has elapsed", () => {
    check.mockResolvedValue(null);
    renderHook(() => useUpdateCheck());
    vi.advanceTimersByTime(UPDATE_CHECK_DELAY_MS - 1);
    expect(check).not.toHaveBeenCalled();
  });

  it("checks once the delay elapses and reports the offered version", async () => {
    check.mockResolvedValue({ version: "0.1.1" });
    const { result } = renderHook(() => useUpdateCheck());
    await runCheck();
    expect(check).toHaveBeenCalledTimes(1);
    expect(result.current.version).toBe("0.1.1");
  });

  it("stays quiet when the app is already current", async () => {
    check.mockResolvedValue(null);
    const { result } = renderHook(() => useUpdateCheck());
    await runCheck();
    expect(result.current.version).toBeNull();
  });

  it("swallows a failed check — a silent launch probe never interrupts", async () => {
    check.mockRejectedValue(new Error("Could not fetch a valid release JSON"));
    const { result } = renderHook(() => useUpdateCheck());
    await runCheck();
    expect(result.current.version).toBeNull();
  });

  it("never checks in the menu-bar panel window", async () => {
    panel.value = true;
    check.mockResolvedValue({ version: "0.1.1" });
    renderHook(() => useUpdateCheck());
    await runCheck();
    expect(check).not.toHaveBeenCalled();
  });

  it("never checks outside the desktop runtime", async () => {
    tauri.value = false;
    check.mockResolvedValue({ version: "0.1.1" });
    renderHook(() => useUpdateCheck());
    await runCheck();
    expect(check).not.toHaveBeenCalled();
  });

  it("clears the pending timer when the shell unmounts", async () => {
    check.mockResolvedValue({ version: "0.1.1" });
    const { unmount } = renderHook(() => useUpdateCheck());
    unmount();
    await runCheck();
    expect(check).not.toHaveBeenCalled();
  });

  it("dismissing keeps that version quiet for the rest of the session", async () => {
    check.mockResolvedValue({ version: "0.1.1" });
    const first = renderHook(() => useUpdateCheck());
    await runCheck();
    act(() => first.result.current.dismiss());
    expect(first.result.current.version).toBeNull();
    expect(sessionStorage.getItem(UPDATE_DISMISSED_KEY)).toBe("0.1.1");

    const second = renderHook(() => useUpdateCheck());
    await runCheck();
    expect(second.result.current.version).toBeNull();
  });

  it("still announces a newer version after an older one was dismissed", async () => {
    sessionStorage.setItem(UPDATE_DISMISSED_KEY, "0.1.1");
    check.mockResolvedValue({ version: "0.1.2" });
    const { result } = renderHook(() => useUpdateCheck());
    await runCheck();
    expect(result.current.version).toBe("0.1.2");
  });
});
