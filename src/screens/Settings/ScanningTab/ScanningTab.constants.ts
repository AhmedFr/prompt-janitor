export interface ScanFrequency {
  key: string;
  label: string;
  detail: string;
}

/** Scan-frequency choices, in the order they render (fastest to most manual). */
export const SCAN_FREQUENCIES: ScanFrequency[] = [
  { key: "1h", label: "Hourly", detail: "Most up-to-date · uses more CPU" },
  { key: "6h", label: "Every 6 hours", detail: "Recommended balance" },
  { key: "1d", label: "Once a day", detail: "Light touch" },
  { key: "save", label: "On file save", detail: "Watch mode · instant" },
  { key: "manual", label: "Manual only", detail: "Scan when you click" },
];
