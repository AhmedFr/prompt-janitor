import type { IconName } from "@/components/Icon";

export type SettingsTabId = "folders" | "scanning" | "notifications" | "checks" | "ai" | "about";

/** The Settings strip, in order (spec §8). No License tab while payments are off (§13a). */
export const SETTINGS_TABS: { id: SettingsTabId; label: string; icon: IconName }[] = [
  { id: "folders", label: "Folders", icon: "folder" },
  { id: "scanning", label: "Scanning", icon: "clock" },
  { id: "notifications", label: "Notifications", icon: "bell" },
  { id: "checks", label: "Checks", icon: "rules" },
  { id: "ai", label: "AI", icon: "sparkles" },
  { id: "about", label: "About", icon: "settings" },
];

/** Tab ids earlier versions linked to, and where each one lives now. */
export const LEGACY_TAB: Record<string, SettingsTabId> = {
  harnesses: "folders",
  schedule: "scanning",
  alerts: "notifications",
  rules: "checks",
  general: "about",
  app: "about",
  license: "about",
};
