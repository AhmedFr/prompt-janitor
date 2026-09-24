import { useArtifactSource } from "../useArtifactSource";
import type { SkillPanelProps } from "./SkillPanel.types";
import { SkillPanelView } from "./SkillPanelView";

/**
 * A skill's markdown, read and edited beside the table it was clicked in.
 *
 * All this does is join the file to the view: `useArtifactSource` owns the
 * read, the save and the errors either can raise, and `SkillPanelView` owns
 * everything that gets drawn.
 */
export function SkillPanel(props: SkillPanelProps) {
  const source = useArtifactSource(props.skill.id);
  return <SkillPanelView {...props} source={source} />;
}
