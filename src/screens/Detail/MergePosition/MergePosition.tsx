import { Card } from "@/components/Card";
import { Grade, type GradeLetter } from "@/components/Grade";
import { KIND_LABEL } from "@/components/ArtifactCard";
import { UsageBadge } from "@/components/UsageBadge";
import type { EffectiveRule } from "@/lib/ipc";
import type { MergeLayer, MergePositionData, MergePositionProps } from "./MergePosition.types";
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

/** `path` without its last segment — the folder a stray rule file governs. */
const parentDir = (path: string) => path.replace(/\/+[^/]*$/, "") || "/";

/**
 * Whether the stack is a fact we actually hold. A failed `get_effective_rules`
 * is not evidence of absence: it must not be reported as "this file is outside
 * the stack", only as "we could not look".
 */
const stackKnown = (state: MergePositionData) => state.effective !== "error";

/**
 * The headline, which is the whole point of the panel: the file is either a
 * rung of a merged stack, a file in a folder no harness has ever seen, or a
 * rule that only applies to the subtree it sits in.
 */
function headline(state: MergePositionData): string {
  if (state.inStack || !stackKnown(state)) return LAYER_HEADLINE[state.layer];
  if (!state.project) return "This folder hasn't been seen by an agent harness";
  return `Not part of ${state.project.name}'s merged rule stack — read only when working in ${parentDir(state.filePath)}`;
}

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

  const { project, filePath, effective, referenced, inStack } = state;
  const known = stackKnown(state);
  // A file in an unknown folder has no stack to show at all; one that sits
  // inside a project but below its root still benefits from seeing what the
  // root loads — labelled as the project's stack, not as this file's.
  const showStack = inStack || !known || project !== null;

  return (
    <Card className="mp">
      <div className="mp__hd">
        <h2 className="mp__title">{headline(state)}</h2>
        {project && <span className="path mp__project">{project.path}</span>}
      </div>

      {showStack && (
        <section className="mp__section">
          <h3 className="mp__sub">{inStack || !known ? "Load order" : "Project's root stack"}</h3>
          {effective === "error" ? (
            <p className="muted mp__empty">Couldn't read the rule stack</p>
          ) : effective.length === 0 ? (
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
      )}

      <section className="mp__section">
        <h3 className="mp__sub">Referenced by name</h3>
        {referenced.length === 0 ? (
          <p className="muted mp__empty">
            No skills, agents, commands, MCP servers or plugins referenced by name
          </p>
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
