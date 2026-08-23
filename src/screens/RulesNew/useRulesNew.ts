import { useCallback, useEffect, useRef, useState } from "react";
import { tableStorageKey } from "@/components/DataTable";
import { commands, isTauri } from "@/lib/ipc";
import { HIGHLIGHT_KEY, TABLE_STATE_PREFIX } from "@/screens/Rules/Rules.constants";
import type { Navigate } from "@/App/App.types";
import { DEFAULT_TAB, EMPTY_DRAFT, SAVE_FAILED } from "./RulesNew.constants";
import type { RuleDraft, RuleKind, RulesNewState } from "./RulesNew.types";
import { canSave, newRuleId } from "./rulesNew.util";

/**
 * Where {@link Rules} lands after a save: a pattern rule is the user's own, a
 * natural-language standard is judged by the model, and those are two
 * different tables.
 */
const TAB_FOR: Record<RuleKind, string> = { pattern: "custom", nl: "ai" };

/** Leave the new rule's id for the Rules screen to land on. Best-effort. */
function rememberHighlight(id: string | undefined): void {
  if (!id) return;
  try {
    window.sessionStorage.setItem(HIGHLIGHT_KEY, id);
  } catch {
    // Storage denied (private-mode restrictions) — no highlight, no harm.
  }
}

/**
 * Drop what the destination tab's table remembers. Each `DataTable` keeps its
 * search, pills and sort per tab, and a search left over from an earlier visit
 * filters the brand-new row straight back out — the user would land on a table
 * that does not contain the rule they just wrote, with the highlight pointing
 * at nothing. Clearing costs one stale filter; not clearing costs the whole
 * point of the trip.
 */
function clearTableFilters(tab: string): void {
  try {
    window.sessionStorage.removeItem(tableStorageKey(TABLE_STATE_PREFIX + tab));
  } catch {
    // See `rememberHighlight` — nothing to clear if storage is denied anyway.
  }
}

/**
 * The id the write just minted, recovered by reading the list back — the IPC
 * bindings return `null` from both add commands. A failure here costs the
 * highlight, never the navigation, so it swallows rather than throws.
 */
async function findNewRuleId(title: string, nl: boolean): Promise<string | undefined> {
  try {
    const res = await commands.listRules();
    return res.status === "ok" ? newRuleId(res.data, title, nl) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The add-rule flow: which kind, what it says, and the one write at the end
 * of it. Reading and maintaining rules stays in `useRules` — this hook only
 * ever creates.
 *
 * `save` does not reject. It owns its failure the way `useRules`' actions do:
 * the form stays exactly as typed and a sentence lands in `error`.
 */
export function useRulesNew({
  initialType,
  navigate,
  aiReady: aiOverride,
}: {
  initialType?: string;
  navigate: Navigate;
  aiReady?: boolean | null;
}): RulesNewState {
  // Coming from the AI tab, the user has already answered the type question —
  // pressing "Add rule" there *is* the answer. Any other tab still gets asked,
  // because "Custom" holds pattern rules and standards alike.
  const [kind, setKind] = useState<RuleKind | null>(initialType === "ai" ? "nl" : null);
  const [draft, setDraft] = useState<RuleDraft>(EMPTY_DRAFT);
  const [fetched, setFetched] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Mirrors `saving`, and read wherever the answer is needed *now*: two clicks
  // in one tick both see the old state value, so state alone cannot stop the
  // second one from starting a duplicate write.
  const savingRef = useRef(false);

  const aiReady = aiOverride !== undefined ? aiOverride : fetched;

  // Same check `useRules` makes, and for the same reason: a standard with no
  // provider behind it is stored but never evaluated, which is worse than not
  // being offered. Entitlement is deliberately not read — monetisation is
  // paused, so a licence must not decide what this flow offers.
  useEffect(() => {
    if (!isTauri || aiOverride !== undefined) return;
    void (async () => {
      try {
        const cfg = await commands.getAiConfig();
        setFetched(cfg.status === "ok" && cfg.data.provider !== "none" && cfg.data.has_key);
      } catch {
        // Unknown stays unknown rather than becoming "no provider": the save
        // itself is the honest gate, and a failed config read is not a
        // statement about the provider.
      }
    })();
  }, [aiOverride]);

  const cancel = useCallback(() => {
    navigate("rules", initialType ?? DEFAULT_TAB);
  }, [navigate, initialType]);

  // Escape abandons the flow from either step — the same key that dismisses
  // every other modal surface in the app. Three things it must not abandon:
  // an IME candidate list (`isComposing`, where Escape is closing the
  // candidate window and never reaches the user's intent), a key something
  // closer to the user already handled (`defaultPrevented`), and a write
  // already in flight — by then the rule may exist, and leaving would strand
  // the user on Rules with no idea whether it landed.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing || event.defaultPrevented) return;
      if (savingRef.current) return;
      cancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cancel]);

  const choose = useCallback((next: RuleKind) => setKind(next), []);
  const back = useCallback(() => setKind(null), []);
  const update = useCallback((patch: Partial<RuleDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  }, []);

  const save = useCallback(async () => {
    if (kind === null || savingRef.current || !canSave(kind, draft, aiReady)) return;
    const title = draft.title.trim();
    const body = draft.body.trim();

    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const res =
        kind === "nl"
          ? await commands.addNlRule(title, body, draft.severity)
          : await commands.addCustomRule(title, body, draft.severity);
      if (res.status !== "ok") throw new Error(res.error);
      rememberHighlight(await findNewRuleId(title, kind === "nl"));
      clearTableFilters(TAB_FOR[kind]);
      // No `setSaving(false)`: the screen is leaving, and the button must not
      // flicker back to enabled on the way out.
      navigate("rules", TAB_FOR[kind]);
    } catch {
      setError(SAVE_FAILED);
      savingRef.current = false;
      setSaving(false);
    }
  }, [kind, draft, aiReady, navigate]);

  return { kind, draft, aiReady, saving, error, choose, back, update, cancel, save };
}
