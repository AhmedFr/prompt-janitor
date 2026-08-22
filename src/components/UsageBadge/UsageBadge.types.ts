import type { UsageStat } from "@/lib/ipc";

export interface UsageBadgeProps {
  /** Rollup for the artifact this badge describes; `null` means never invoked. */
  usage: UsageStat | null;
  /** Reference instant for relative-time formatting. Defaults to `new Date()`. */
  now?: Date;
}
