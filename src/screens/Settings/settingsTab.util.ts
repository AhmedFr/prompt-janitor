import { LEGACY_TAB, SETTINGS_TABS, type SettingsTabId } from "./Settings.constants";

/** A tab id from anywhere (a deep link, an old notification) resolved to a tab that exists. */
export function resolveSettingsTab(raw: string | undefined): SettingsTabId {
  if (!raw) return SETTINGS_TABS[0].id;
  const current = SETTINGS_TABS.find((t) => t.id === raw);
  if (current) return current.id;
  return LEGACY_TAB[raw] ?? SETTINGS_TABS[0].id;
}
