import type { ReactNode } from "react";
import type { IconName, IconProps } from "./Icon.types";

/** SF-style line icons, drawn on a 24×24 grid with `currentColor` stroke. */
const PATHS: Record<IconName, ReactNode> = {
  logo: (
    <>
      <line x1="5" y1="6" x2="19" y2="6" />
      <line x1="5" y1="11" x2="14" y2="11" />
      <line x1="5" y1="16" x2="9" y2="16" strokeOpacity=".5" />
      <path d="M15 15.5l1.5 1.5M16.5 15.5L15 17" strokeWidth="1.4" />
    </>
  ),
  dashboard: (
    <>
      <path d="M4 13a8 8 0 0 1 16 0" />
      <path d="M12 13l4-3" />
      <circle cx="12" cy="13" r="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  prompts: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v4h4" />
      <line x1="9" y1="12" x2="15" y2="12" />
      <line x1="9" y1="15.5" x2="13" y2="15.5" />
    </>
  ),
  scans: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v3.5h-3.5" />
      <path d="M12 8v4l2.5 1.5" />
    </>
  ),
  rules: (
    <>
      <path d="M4 6.5l1.6 1.6L9 5" />
      <path d="M4 13l1.6 1.6L9 11.5" />
      <line x1="12" y1="7" x2="20" y2="7" />
      <line x1="12" y1="13" x2="20" y2="13" />
      <line x1="12" y1="18.5" x2="16" y2="18.5" />
      <path d="M4 18.5l1.6 1.6L9 17.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2.5M12 18.5V21M21 12h-2.5M5.5 12H3M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8M18.4 18.4l-1.8-1.8M7.4 7.4L5.6 5.6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <line x1="20" y1="20" x2="15.5" y2="15.5" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14-4.5L4 8" />
      <path d="M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14 4.5L20 16" />
      <path d="M20 20v-4h-4" />
    </>
  ),
  chevronRight: <polyline points="9 5 16 12 9 19" />,
  chevronDown: <polyline points="5 9 12 16 19 9" />,
  sparkles: (
    <>
      <path d="M12 4l1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6z" />
      <path d="M18 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  bell: (
    <>
      <path d="M18 9a6 6 0 0 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" />
      <path d="M10.5 20a2 2 0 0 0 3 0" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </>
  ),
  check: <polyline points="5 12.5 10 17.5 19 7" />,
  x: (
    <>
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
    </>
  ),
  arrowUp: (
    <>
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="6 11 12 5 18 11" />
    </>
  ),
  arrowDown: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="6 13 12 19 18 13" />
    </>
  ),
  wand: (
    <>
      <path d="M6 18L16 8" />
      <path d="M15 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z" />
      <circle cx="7" cy="17" r="0.5" />
    </>
  ),
  lock: (
    <>
      <rect x="5.5" y="11" width="13" height="9" rx="2" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
      <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  barChart: (
    <>
      <line x1="6" y1="19" x2="6" y2="10" />
      <line x1="12" y1="19" x2="12" y2="5" />
      <line x1="18" y1="19" x2="18" y2="13" />
    </>
  ),
};

export function Icon({ name, size = 18, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  );
}
