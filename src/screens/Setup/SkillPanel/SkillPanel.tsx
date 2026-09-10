import type { SkillPanelProps } from "./SkillPanel.types";
import { SkillPanelView } from "./SkillPanelView";
import { useSkillSource } from "./useSkillSource";

/**
 * A skill's markdown, read and edited beside the table it was clicked in.
 *
 * All this does is join the file to the view: `useSkillSource` owns the read,
 * the save and the errors either can raise, and `SkillPanelView` owns
 * everything that gets drawn.
 */
export function SkillPanel({ skill, onClose, onSaved }: SkillPanelProps) {
  const source = useSkillSource(skill.id);
  return <SkillPanelView skill={skill} source={source} onClose={onClose} onSaved={onSaved} />;
}
