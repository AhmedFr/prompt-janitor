import type { Grade } from "@/lib/ipc";

export interface ProjectGlyphProps {
  name: string;
  grade: Grade;
  /** Detected logo data URI, if any. */
  logo?: string | null;
  /** Square size in px. Default 26. */
  size?: number;
}
