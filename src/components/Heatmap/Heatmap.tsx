import { useMemo } from "react";
import type { HeatmapProps } from "./Heatmap.types";
import { bucketFiles } from "./heatmap.util";
import "./Heatmap.css";

/** Mosaic of one grade-colored square per file, best score first. */
export function Heatmap({ files, onSelect }: HeatmapProps) {
  const { squares } = useMemo(() => bucketFiles(files), [files]);

  return (
    <div className="heatmap" aria-label="Files by grade">
      {squares.map((s) => (
        <button
          key={s.id}
          type="button"
          className={`heatmap__sq grade-bg--${s.grade.toLowerCase()}`}
          title={`${s.name} · ${s.grade} · ${s.score}/100`}
          aria-label={`${s.name}, grade ${s.grade}, ${s.score} out of 100`}
          onClick={onSelect ? () => onSelect(s.id) : undefined}
        />
      ))}
    </div>
  );
}
