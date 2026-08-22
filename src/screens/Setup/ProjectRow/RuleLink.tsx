import { Grade, type GradeLetter } from "@/components/Grade";
import type { EffectiveRule } from "@/lib/ipc";
import type { RuleLinkProps } from "./ProjectRow.types";

const LAYER_LABEL: Record<EffectiveRule["layer"], string> = {
  global: "Global",
  project: "Project",
  plugin: "Plugin",
};

/** One rung of a project's rule stack; clickable when the grader has a file for it. */
export function RuleLink({ rule, navigate }: RuleLinkProps) {
  const body = (
    <>
      <span className="setup-rules__layer">{LAYER_LABEL[rule.layer]}</span>
      <span className="setup-rules__name">{rule.name}</span>
      <span className="path setup-rules__path">{rule.path}</span>
      {/* The DB only writes A–F; the IPC type is a loose string. */}
      <Grade grade={rule.grade as GradeLetter | null} size="sm" />
    </>
  );

  if (!rule.file_id) return <span className="setup-rules__row">{body}</span>;
  const fileId = rule.file_id;
  return (
    <button
      type="button"
      className="setup-rules__row setup-rules__row--link"
      onClick={() => navigate("detail", fileId)}
    >
      {body}
    </button>
  );
}
