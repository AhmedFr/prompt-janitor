import { useState } from "react";
import { Icon } from "@/components/Icon";
import type { ProjectGlyphProps } from "./ProjectGlyph.types";
import "./ProjectGlyph.css";

/**
 * A project's visual mark: its detected logo, else a grade-tinted folder.
 *
 * A logo that fails to decode (a truncated PNG, an SVG the webview rejects)
 * falls back to the folder rather than leaving a broken-image box. The failure
 * is remembered per `logo` value, so a rescan that finds a different file gets
 * a fresh attempt instead of staying on the folder for good.
 */
export function ProjectGlyph({ name, grade, logo, size = 26 }: ProjectGlyphProps) {
  const [failed, setFailed] = useState<string | null>(null);

  if (logo && logo !== failed) {
    return (
      <img
        className="project-glyph project-glyph--logo"
        src={logo}
        alt=""
        width={size}
        height={size}
        onError={() => setFailed(logo)}
      />
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
