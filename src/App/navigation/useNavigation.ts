import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import type { Navigate } from "../App.types";
import { resolveExternal } from "./legacy";
import { canGoBack, current, initialHistory, navReducer } from "./navigation";
import type { Navigation, NavState } from "./navigation.types";

/** ⌘[ in a field is the field's own shortcut (outdent), not Back. */
const typing = (el: Element | null) =>
  el instanceof HTMLInputElement ||
  el instanceof HTMLTextAreaElement ||
  (el instanceof HTMLElement && el.isContentEditable);

/** Plain ⌘[ only: a modifier, a held key or a handler that got there first means it is not Back. */
const isBackKey = (e: KeyboardEvent) =>
  e.key === "[" && e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey && !e.repeat && !e.defaultPrevented;

/**
 * The main window's one navigation state and its back stack (spec §10), with
 * ⌘[ as Back. Every callback is identity-stable: screens hand `navigate` to
 * `useCallback`s of their own, and Setup's column cache keys on it.
 *
 * Back can be guarded: while a screen holds work that Back would throw away
 * (the viewer's unsaved draft), `back()` asks that screen instead of popping.
 */
export function useNavigation(): Navigation {
  const [history, dispatch] = useReducer(navReducer, undefined, () => initialHistory());
  const guard = useRef<(() => void) | null>(null);
  // Read by `back`, which stays stable: a guard is only asked when Back would go somewhere.
  const reachable = useRef(false);
  useEffect(() => {
    reachable.current = canGoBack(history);
  }, [history]);

  const push = useCallback((state: NavState) => dispatch({ type: "push", state }), []);
  const replace = useCallback((state: NavState) => dispatch({ type: "replace", state }), []);
  const back = useCallback(() => {
    if (!reachable.current) return;
    if (guard.current) guard.current();
    else dispatch({ type: "back" });
  }, []);
  const closeItem = useCallback(() => dispatch({ type: "closeItem" }), []);
  const navigate = useCallback<Navigate>((route, target) => push(resolveExternal(route, target)), [push]);
  const registerBackGuard = useCallback((onBack: () => void) => {
    guard.current = onBack;
    return () => {
      if (guard.current === onBack) guard.current = null;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isBackKey(e) && !typing(document.activeElement)) {
        e.preventDefault();
        back();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [back]);

  return useMemo(
    () => ({
      state: current(history),
      canGoBack: canGoBack(history),
      navigate,
      push,
      replace,
      back,
      closeItem,
      registerBackGuard,
    }),
    [history, navigate, push, replace, back, closeItem, registerBackGuard],
  );
}
