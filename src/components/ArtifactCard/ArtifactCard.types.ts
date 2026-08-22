import type { ArtifactView } from "@/lib/ipc";

export interface ArtifactCardProps {
  /** The inventoried artifact (rule, skill, agent, command, hook, mcp_server, plugin, or settings). */
  artifact: ArtifactView;
  /** Called with the artifact's `file_id` when a graded rule card is opened. */
  onOpen?: (fileId: string) => void;
}
