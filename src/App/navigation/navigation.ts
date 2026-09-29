import type { NavAction, NavHistory, NavState } from "./navigation.types";

const same = (a: NavState, b: NavState) => JSON.stringify(a) === JSON.stringify(b);

export const initialHistory = (state: NavState = { route: "setup", target: {} }): NavHistory => ({
  entries: [state],
  index: 0,
});
export const current = (h: NavHistory): NavState => h.entries[h.index];
export const canGoBack = (h: NavHistory): boolean => h.index > 0;

/** The setup state with the open item (and its tab) removed. */
function withoutItem(s: NavState): NavState {
  if (s.route !== "setup") return s;
  const { open: _open, tab: _tab, ...rest } = s.target;
  return { route: "setup", target: rest };
}

export function navReducer(h: NavHistory, a: NavAction): NavHistory {
  switch (a.type) {
    case "push": {
      if (same(current(h), a.state)) return h;
      const entries = [...h.entries.slice(0, h.index + 1), a.state];
      return { entries, index: entries.length - 1 };
    }
    case "replace": {
      const entries = [...h.entries];
      entries[h.index] = a.state;
      return { entries, index: h.index };
    }
    case "back":
      return h.index > 0 ? { entries: h.entries, index: h.index - 1 } : h;
    case "closeItem": {
      const closed = withoutItem(current(h));
      // Opening the item pushed an entry; closing it is Back (spec §10) — and
      // the forward entry it leaves is dropped, so after open → close there is
      // exactly the one entry and no Forward into a closed viewer. A viewer
      // that arrived by deep link has no such entry behind it: Back would
      // leave Setup altogether, so closing replaces instead.
      if (h.index > 0 && same(h.entries[h.index - 1], closed)) {
        return { entries: h.entries.slice(0, h.index), index: h.index - 1 };
      }
      return navReducer(h, { type: "replace", state: closed });
    }
  }
}
