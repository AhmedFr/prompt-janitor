import { resolveSettingsTab } from "@/screens/Settings/settingsTab.util";
import { isRuleTab } from "@/screens/Settings/ChecksTab/ChecksLibrary/checksLibrary.columns";
import { parseSetupTarget } from "../setupTarget";
import type { NavState } from "./navigation.types";

/** Setup with nothing selected — a fresh value each time, so no caller shares (and mutates) it. */
const setupHome = (): NavState => ({ route: "setup", target: {} });

/**
 * A (route, target) pair from outside the window, or from a link written
 * before navigation state existed, resolved to a place that exists. The
 * panel's `navigate` event, old notifications and in-app `navigate(route,
 * target)` calls all come through here, so no route can blank the shell.
 */
export function resolveExternal(route: string, target: string | null | undefined): NavState {
  const t = target ?? undefined;
  switch (route) {
    case "setup":
      return { route: "setup", target: parseSetupTarget(t) };
    case "projects":
      return { route: "projects" };
    case "settings":
      return { route: "settings", tab: resolveSettingsTab(t) };
    // Rules moved into Settings → Checks (spec §8); an old link still names
    // the rule table it meant, and that survives the move.
    case "rules":
    case "rules-new":
      return isRuleTab(t) ? { route: "settings", tab: "checks", checksTab: t } : { route: "settings", tab: "checks" };
    case "prompts":
      return { route: "setup", target: { kind: "rule" } };
    case "detail":
      return t ? { route: "setup", target: { open: { fileId: t }, tab: "findings" } } : setupHome();
    case "project":
      return t ? { route: "setup", target: { lens: t } } : setupHome();
    default:
      return setupHome();
  }
}
