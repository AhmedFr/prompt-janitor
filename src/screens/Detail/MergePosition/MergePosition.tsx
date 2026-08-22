import { Card } from "@/components/Card";
import { Grade, type GradeLetter } from "@/components/Grade";
import { KIND_LABEL } from "@/components/ArtifactCard";
import { UsageBadge } from "@/components/UsageBadge";
import type { EffectiveRule } from "@/lib/ipc";
import type { MergeLayer, MergePositionProps } from "./MergePosition.types";
import "./MergePosition.css";

/** The one sentence that answers "when does this file even get read?". */
const LAYER_HEADLINE: Record<MergeLayer, string> = {
  global: "Global rules — loaded in every project",
  project: "Project rules — loaded after global",
};

const LAYER_LABEL: Record<EffectiveRule["layer"], string> = {
  global: "Global",
  project: "Project",
  plugin: "Plugin",
};

/**
 * Where the viewed file sits in the harness's merge order, and which artifacts
 * it summons by name.
 *
 * A prompt is never read alone — it is concatenated with everything above it in
 * the stack, and it pulls in whatever it names. Both facts change how its score
 * should be read, so they belong next to the issues rather than one screen away
 * in Setup.
 */
export function MergePosition({ state, now }: MergePositionProps) {
  // Nothing to hold a place for: the section appears once the setup is known.
  if (state === null) return null;

  if (state === "error") {
    return (
      <Card padded className="mp">
        <p className="muted mp__empty">Setup not available</p>
      </Card>
    );
  }

  const { layer, project, filePath, effective, referenced } = state;

  return (
    <Card className="mp">
      <div className="mp__hd">
        <h2 className="mp__title">{LAYER_HEADLINE[layer]}</h2>
        {project && <span className="path mp__project">{project.path}</span>}
      </div>

      <section className="mp__section">
        <h3 className="mp__sub">Load order</h3>
        {effective.length === 0 ? (
          <p className="muted mp__empty">No rule files apply here.</p>
        ) : (
          <ol className="mp__list">
            {effective.map((rule) => {
              const isSelf = rule.path === filePath;
              return (
                <li
                  key={rule.path}
                  className={"mp__rule" + (isSelf ? " mp__rule--self" : "")}
                  aria-current={isSelf ? "true" : undefined}
                >
                  <span className="mp__layer">{LAYER_LABEL[rule.layer]}</span>
                  <span className="mp__name">{rule.name}</span>
                  {isSelf && <span className="mp__self">this file</span>}
                  {/* The DB only ever writes A–F, but the IPC type is a loose
                      string. Say "ungraded" in words: an F-shaped chip would
                      read as a verdict the grader never gave. */}
                  {rule.grade ? (
                    <Grade grade={rule.grade as GradeLetter} size="sm" />
                  ) : (
                    <span className="mp__ungraded">ungraded</span>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="mp__section">
        <h3 className="mp__sub">Referenced by name</h3>
        {referenced.length === 0 ? (
          <p className="muted mp__empty">No skills, agents or MCP servers referenced by name</p>
        ) : (
          <ul className="mp__list">
            {referenced.map((artifact) => (
              <li key={artifact.id} className="mp__ref">
                <span className="mp__layer">{KIND_LABEL[artifact.kind]}</span>
                <span className="mp__name">{artifact.name}</span>
                <UsageBadge usage={artifact.usage} now={now} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </Card>
  );
}
