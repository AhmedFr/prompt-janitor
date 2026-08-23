import type { PanelFix } from "@/lib/ipc";

export interface PanelFixesProps {
  /** At most three, worst first — the backend has already ranked them. */
  fixes: PanelFix[];
  /** Open a file's detail page in the main window. */
  onOpen: (fileId: string) => void;
}
