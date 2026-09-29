import { useCallback, useEffect, useMemo, useReducer } from "react";
import type { Navigate } from "../App.types";
import { resolveExternal } from "./legacy";
import { canGoBack, current, initialHistory, navReducer } from "./navigation";
import type { Navigation, NavState } from "./navigation.types";

/** ⌘[ in a field is the field's own shortcut (outdent), not Back. */
const typing = (el: Element | null) =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLElement && el.isContentEditable);

/**
 * The main window's one navigation state and its back stack (spec §10), with
 * ⌘[ as Back. Every callback is identity-stable: screens hand `navigate` to
 * `useCallback`s of their own, and Setup's column cache keys on it.
 */
export function useNavigation(): Navigation {
  const [history, dispatch] = useReducer(navReducer, undefined, () => initialHistory());
  const push = useCallback((state: NavState) => dispatch({ type: "push", state }), []);
  const replace = useCallback((state: NavState) => dispatch({ type: "replace", state }), []);
  const back = useCallback(() => dispatch({ type: "back" }), []);
  const closeItem = useCallback(() => dispatch({ type: "closeItem" }), []);
  const navigate = useCallback<Navigate>((route, target) => push(resolveExternal(route, target)), [push]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "[" && !typing(document.activeElement)) {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back]);

  return useMemo(
    () => ({ state: current(history), canGoBack: canGoBack(history), navigate, push, replace, back, closeItem }),
    [history, navigate, push, replace, back, closeItem],
  );
}
