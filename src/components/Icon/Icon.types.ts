import type { SVGProps } from "react";

export type IconName =
  | "logo"
  | "dashboard"
  | "prompts"
  | "scans"
  | "rules"
  | "settings"
  | "search"
  | "plus"
  | "refresh"
  | "chevronRight"
  | "chevronDown"
  | "sparkles"
  | "folder"
  | "bell"
  | "clock"
  | "check"
  | "x"
  | "arrowUp"
  | "arrowDown"
  | "wand"
  | "lock"
  | "barChart";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  /** Square size in px. Defaults to 18. */
  size?: number;
}
