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

function readStored(key: string, initial: string): string {
  if (!canUseStorage()) return initial;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + key);
    return raw ?? initial;
  } catch {
    // Storage access denied (e.g. private-mode restrictions).
    return initial;
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
 * A `Tabs` strip's active tab, remembered per strip in `sessionStorage` under
 * `pj.tabs.<key>` so switching screens and coming back reopens the same tab.
 * `Tabs` itself stays a plain controlled component (see `Tabs.types.ts`); a
 * screen that wants memory wires this hook's state into `active`/`onChange`
 * — the same split `DataTable` uses between `useTableState` and the table.
 *
 * Mirrors `useTableState`'s storage guards but keeps to a single string: a
 * tab strip has nothing else worth persisting, so a `pills`-free `TableState`
 * would just be a string wearing an object's clothes.
 */
export function useTabState(key: string, initial: string): [string, (id: string) => void] {
  const [active, setActive] = useState<string>(() => readStored(key, initial));
  const [loadedKey, setLoadedKey] = useState(key);

  // One component can render a different tab strip per screen, changing `key`
  // without unmounting. Adjusting during render rather than in an effect
  // keeps the previous strip's tab from being painted under the new key.
  if (loadedKey !== key) {
    setLoadedKey(key);
    setActive(readStored(key, initial));
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
