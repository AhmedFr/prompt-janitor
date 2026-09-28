import { useEffect, useState } from "react";
import type { RuleTabId } from "./ChecksLibrary/ChecksLibrary.types";
import { AddCheck } from "./AddCheck";
import { ChecksLibrary } from "./ChecksLibrary";
import type { ChecksTabProps } from "./ChecksTab.types";

/** Settings → Checks: the check library, and the add form in its place while it is open. */
export function ChecksTab({ initialTab }: ChecksTabProps) {
  const [adding, setAdding] = useState<RuleTabId | null>(null);
  const [returnTo, setReturnTo] = useState<RuleTabId | undefined>(initialTab);
  // A deep link that arrives while the tab is open (Settings stays mounted).
  useEffect(() => {
    if (initialTab) setReturnTo(initialTab);
  }, [initialTab]);
  if (adding) {
    return (
      <AddCheck
        initialType={adding}
        onDone={(tab) => {
          setReturnTo(tab);
          setAdding(null);
        }}
      />
    );
  }
  // Keyed so a new table remounts the library, which reads its tab once.
  return <ChecksLibrary key={returnTo ?? "default"} initialTab={returnTo} onAdd={setAdding} />;
}
