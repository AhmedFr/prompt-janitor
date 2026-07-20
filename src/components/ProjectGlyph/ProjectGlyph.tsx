import { Icon } from "@/components/Icon";
import type { ProjectGlyphProps } from "./ProjectGlyph.types";
import "./ProjectGlyph.css";

/** A project's visual mark: its detected logo, else a grade-tinted folder. */
export function ProjectGlyph({ name, grade, logo, size = 26 }: ProjectGlyphProps) {
  if (logo) {
    return (
      <img className="project-glyph project-glyph--logo" src={logo} alt="" width={size} height={size} />
    );
  }
  return (
    <span
      className={`project-glyph project-glyph--folder grade-tint--${grade.toLowerCase()}`}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${name} project`}
    >
      <Icon name="folder" size={size * 0.6} />
    </span>
  );
}
