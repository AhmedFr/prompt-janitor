import { useCallback, useState } from "react";

/** Prefix every tab strip's sessionStorage entry shares, namespaced under the app. */
const STORAGE_PREFIX = "pj.tabs.";

/**
 * Outside the browser (SSR, Storybook's node renderer, tests that stub
 * `window` away) there is no session to persist into.
 */
function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.sessionStorage;
}

/** Raw stored value for `key`, or `null` if there is none (or none readable). */
function readStored(key: string): string | null {
  if (!canUseStorage()) return null;
  try {
    return window.sessionStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    // Storage access denied (e.g. private-mode restrictions).
    return null;
  }
}

function writeStored(key: string, value: string): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.setItem(STORAGE_PREFIX + key, value);
  } catch {
    // Storage full or unavailable — the strip just won't remember this session.
  }
}

/**
 * Falls back through `candidate` → `initial` → the first id in `validIds`, so
 * a stale `sessionStorage` entry (a tab that got removed since the value was
 * written) or a tab set that shrank under an already-mounted strip never
 * resolves to an id nothing in `items` actually has.
 */
function resolveActive(candidate: string | null, initial: string, validIds: string[]): string {
  if (candidate !== null && validIds.includes(candidate)) return candidate;
  if (validIds.includes(initial)) return initial;
  return validIds[0] ?? initial;
}

/**
 * A `Tabs` strip's active tab, remembered per strip in `sessionStorage` under
 * `pj.tabs.<key>` so switching screens and coming back reopens the same tab.
 * `Tabs` itself stays a plain controlled component (see `Tabs.types.ts`); a
 * screen that wants memory wires this hook's state into `active`/`onChange`
 * — the same split `DataTable` uses between `useTableState` and the table.
 *
 * `validIds` is the caller's current tab id set (typically `items.map(i =>
 * i.id)`). It's re-checked against on every render, not just on mount: a
 * screen whose tab set can shrink (a kind with zero rows drops its tab)
 * would otherwise leave `active` pointing at a tab that no longer exists.
 *
 * Mirrors `useTableState`'s storage guards but keeps to a single string: a
 * tab strip has nothing else worth persisting, so a `pills`-free `TableState`
 * would just be a string wearing an object's clothes.
 */
export function useTabState(
  key: string,
  initial: string,
  validIds: string[],
): [string, (id: string) => void] {
  const [active, setActive] = useState<string>(() => resolveActive(readStored(key), initial, validIds));
  const [loadedKey, setLoadedKey] = useState(key);

  // One component can render a different tab strip per screen, changing `key`
  // without unmounting. Adjusting during render rather than in an effect
  // keeps the previous strip's tab from being painted under the new key.
  if (loadedKey !== key) {
    setLoadedKey(key);
    setActive(resolveActive(readStored(key), initial, validIds));
  } else if (validIds.length > 0 && !validIds.includes(active)) {
    // The remembered tab dropped out of the current set — reresolve without
    // re-reading storage, and only if that actually changes anything, so an
    // empty `validIds` (nothing to fall back to yet) can't loop forever.
    const fallback = resolveActive(null, initial, validIds);
    if (fallback !== active) setActive(fallback);
  }

  const set = useCallback(
    (id: string) => {
      setActive(id);
      writeStored(key, id);
    },
    [key],
  );

  return [active, set];
}
