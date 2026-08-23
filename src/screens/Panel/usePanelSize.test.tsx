import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, act } from "@testing-library/react";
import { usePanelSize } from "./usePanelSize";

const setSize = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: () => ({ setSize }) }));

// A getter rather than a constant: one case has to run as the browser build,
// where there is no window to resize.
const env = vi.hoisted(() => ({ tauri: true }));
vi.mock("@/lib/ipc", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ipc")>("@/lib/ipc");
  return {
    ...actual,
    get isTauri() {
      return env.tauri;
    },
  };
});

/**
 * jsdom lays nothing out: it has no ResizeObserver and every element measures
 * zero. Both are stubbed here — the callback is kept so a test can announce a
 * resize, and the height is read from a variable the test sets.
 */
const observers = { notify: [] as (() => void)[] };
let cardHeight = 0;

class ResizeObserverStub {
  constructor(callback: ResizeObserverCallback) {
    observers.notify.push(() => callback([], this as unknown as ResizeObserver));
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

/** Mounts the hook on a plain div — the card the panel attaches it to in the app. */
function Card() {
  const ref = usePanelSize<HTMLDivElement>();
  return <div ref={ref} />;
}

describe("usePanelSize", () => {
  beforeEach(() => {
    env.tauri = true;
    cardHeight = 0;
    observers.notify = [];
    setSize.mockReset().mockResolvedValue(undefined);
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
    Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
      configurable: true,
      get: () => cardHeight,
    });
  });

  afterEach(cleanup);

  /** A 480 px window around a 300 px card is 180 px of dead space under the content. */
  it("sizes the window to the card it measured", () => {
    cardHeight = 412;
    render(<Card />);
    expect(setSize).toHaveBeenCalledTimes(1);
    expect(setSize.mock.calls[0][0]).toMatchObject({ width: 360, height: 420 });
  });

  it("follows the card when its content changes height", () => {
    cardHeight = 412;
    render(<Card />);
    cardHeight = 300;
    act(() => observers.notify.forEach((notify) => notify()));
    expect(setSize).toHaveBeenCalledTimes(2);
    expect(setSize.mock.calls[1][0]).toMatchObject({ width: 360, height: 308 });
  });

  /** A resize call per repaint would fight the window server for no reason. */
  it("stays quiet when the measurement has not moved", () => {
    cardHeight = 412;
    render(<Card />);
    act(() => observers.notify.forEach((notify) => notify()));
    expect(setSize).toHaveBeenCalledTimes(1);
  });

  /** Storybook and the test runner have no window of their own to resize. */
  it("does nothing outside the desktop runtime", () => {
    env.tauri = false;
    cardHeight = 412;
    render(<Card />);
    expect(setSize).not.toHaveBeenCalled();
  });
});
