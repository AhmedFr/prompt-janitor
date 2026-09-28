import { describe, expect, it } from "vitest";
import { SETTINGS_TABS } from "./Settings.constants";
import { resolveSettingsTab } from "./settingsTab.util";

describe("Settings tabs", () => {
  it("are exactly Folders, Scanning, Notifications, Checks, AI, About (spec §8)", () => {
    expect(SETTINGS_TABS.map((t) => t.label)).toEqual([
      "Folders", "Scanning", "Notifications", "Checks", "AI", "About",
    ]);
  });

  it.each([
    ["harnesses", "folders"],
    ["schedule", "scanning"],
    ["alerts", "notifications"],
    ["rules", "checks"],
    ["general", "about"],
    ["app", "about"],
    ["license", "about"],
    ["ai", "ai"],
    ["checks", "checks"],
  ])("maps the old or current id %s to %s", (raw, expected) => {
    expect(resolveSettingsTab(raw)).toBe(expected);
  });

  it("falls back to the first tab for anything unknown or missing", () => {
    expect(resolveSettingsTab(undefined)).toBe("folders");
    expect(resolveSettingsTab("nope")).toBe("folders");
  });
});
