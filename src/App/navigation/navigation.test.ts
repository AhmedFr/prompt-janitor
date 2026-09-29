import { describe, expect, it } from "vitest";
import { canGoBack, current, HISTORY_LIMIT, initialHistory, navReducer } from "./navigation";
import type { NavAction, NavHistory, NavState } from "./navigation.types";

const setup = (target = {}): NavState => ({ route: "setup", target });

describe("navReducer", () => {
  it("starts on Setup with nothing to go back to", () => {
    const h = initialHistory();
    expect(current(h)).toEqual(setup());
    expect(canGoBack(h)).toBe(false);
  });

  it("pushes and goes back, restoring lens, filter and open item", () => {
    let h = initialHistory(setup({ lens: "/w", filter: "never" }));
    h = navReducer(h, { type: "push", state: setup({ lens: "/w", filter: "never", open: { artifactId: 4 } }) });
    h = navReducer(h, { type: "push", state: { route: "projects" } });
    h = navReducer(h, { type: "back" });
    expect(current(h)).toEqual(setup({ lens: "/w", filter: "never", open: { artifactId: 4 } }));
    h = navReducer(h, { type: "back" });
    expect(current(h)).toEqual(setup({ lens: "/w", filter: "never" }));
  });

  it("restores the Checks sub-tab on the way back to Settings", () => {
    let h = initialHistory({ route: "settings", tab: "checks", checksTab: "custom" });
    h = navReducer(h, { type: "push", state: { route: "projects" } });
    h = navReducer(h, { type: "back" });
    expect(current(h)).toEqual({ route: "settings", tab: "checks", checksTab: "custom" });
  });

  it("drops the forward entries when pushing after going back", () => {
    let h = initialHistory();
    h = navReducer(h, { type: "push", state: { route: "projects" } });
    h = navReducer(h, { type: "back" });
    h = navReducer(h, { type: "push", state: { route: "settings", tab: "ai" } });
    expect(h.entries).toHaveLength(2);
  });

  it("does not stack an entry identical to the current one", () => {
    const h = navReducer(initialHistory(), { type: "push", state: setup() });
    expect(h.entries).toHaveLength(1);
  });

  it("replaces without growing the stack", () => {
    const h = navReducer(initialHistory(setup({ open: { artifactId: 1 }, tab: "content" })), {
      type: "replace", state: setup({ open: { artifactId: 1 }, tab: "usage" }),
    });
    expect(h.entries).toHaveLength(1);
    expect(current(h)).toEqual(setup({ open: { artifactId: 1 }, tab: "usage" }));
  });

  it("closing the viewer pops the entry that opened it", () => {
    let h = initialHistory(setup({ kind: "skill" }));
    h = navReducer(h, { type: "push", state: setup({ kind: "skill", open: { artifactId: 2 } }) });
    h = navReducer(h, { type: "closeItem" });
    expect(h.entries).toHaveLength(1);
    expect(h.index).toBe(0);
    expect(current(h)).toEqual(setup({ kind: "skill" }));
  });

  it("closing the viewer drops the forward history beyond it", () => {
    let h = initialHistory(setup());
    h = navReducer(h, { type: "push", state: setup({ open: { artifactId: 2 } }) });
    h = navReducer(h, { type: "push", state: { route: "projects" } });
    h = navReducer(h, { type: "back" });
    h = navReducer(h, { type: "closeItem" });
    expect(h.entries).toEqual([setup()]);
    expect(canGoBack(h)).toBe(false);
  });

  it("closing a viewer opened by a deep link replaces instead of popping somewhere else", () => {
    let h = initialHistory({ route: "projects" });
    h = navReducer(h, { type: "push", state: setup({ open: { fileId: "/f" }, tab: "findings" }) });
    h = navReducer(h, { type: "closeItem" });
    expect(current(h)).toEqual(setup({}));
    expect(h.entries).toHaveLength(2);
  });

  it("going back at the start does nothing", () => {
    const h = initialHistory();
    expect(navReducer(h, { type: "back" })).toBe(h);
  });

  it("closing a deep-linked viewer at the start of history replaces in place", () => {
    const h = navReducer(initialHistory(setup({ open: { fileId: "/f" }, tab: "findings" })), { type: "closeItem" });
    expect(h.entries).toEqual([setup()]);
    expect(h.index).toBe(0);
  });

  it("closing does nothing while no viewer is open, even over two identical entries", () => {
    // A replace can leave the entry behind the current one equal to it.
    let h = initialHistory(setup({ kind: "skill" }));
    h = navReducer(h, { type: "push", state: setup({ kind: "skill", open: { artifactId: 2 } }) });
    h = navReducer(h, { type: "replace", state: setup({ kind: "skill" }) });
    expect(navReducer(h, { type: "closeItem" })).toBe(h);
    const onProjects = initialHistory({ route: "projects" });
    expect(navReducer(onProjects, { type: "closeItem" })).toBe(onProjects);
  });

  it("compares states regardless of key order", () => {
    let h = initialHistory({ route: "setup", target: { kind: "skill", lens: "/w" } });
    h = navReducer(h, { type: "push", state: { route: "setup", target: { lens: "/w", kind: "skill" } } });
    expect(h.entries).toHaveLength(1);
    h = navReducer(h, { type: "push", state: { target: { lens: "/w", kind: "skill", open: { artifactId: 3 } }, route: "setup" } });
    h = navReducer(h, { type: "closeItem" });
    expect(h.entries).toHaveLength(1);
  });

  it("treats an absent field and an undefined one as the same state", () => {
    const h = navReducer(initialHistory(setup({ kind: "skill" })), {
      type: "push", state: setup({ kind: "skill", open: undefined, tab: undefined }),
    });
    expect(h.entries).toHaveLength(1);
  });

  it("keeps at most HISTORY_LIMIT entries, dropping the oldest", () => {
    let h = initialHistory(setup({ lens: "/0" }));
    for (let i = 1; i <= HISTORY_LIMIT + 5; i++) h = navReducer(h, { type: "push", state: setup({ lens: `/${i}` }) });
    expect(h.entries).toHaveLength(HISTORY_LIMIT);
    expect(h.index).toBe(HISTORY_LIMIT - 1);
    expect(current(h)).toEqual(setup({ lens: `/${HISTORY_LIMIT + 5}` }));
    expect(h.entries[0]).toEqual(setup({ lens: "/6" }));
  });

  it("never mutates the history it is given", () => {
    const actions: NavAction[] = [
      { type: "push", state: setup({ open: { artifactId: 1 } }) },
      { type: "replace", state: setup({ open: { artifactId: 1 }, tab: "usage" }) },
      { type: "push", state: { route: "projects" } },
      { type: "back" },
      { type: "closeItem" },
      { type: "back" },
    ];
    let h: NavHistory = initialHistory(setup({ kind: "skill" }));
    for (const a of actions) {
      const before = structuredClone(h);
      const next = navReducer(h, a);
      expect(h).toEqual(before);
      h = next;
    }
  });
});
