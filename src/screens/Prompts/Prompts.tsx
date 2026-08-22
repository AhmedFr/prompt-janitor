import { useEffect, useMemo, useRef, useState } from "react";
import { Grade } from "@/components/Grade";
import { Icon } from "@/components/Icon";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { ProviderIcon } from "@/components/ProviderIcon";
import { ProjectGlyph } from "@/components/ProjectGlyph";
import { TemplatePicker, useTemplatePicker } from "@/components/TemplatePicker";
import { commands, isTauri, type Grade as GradeT } from "@/lib/ipc";
import { relativeTime } from "@/lib/format";
import type { Navigate } from "@/App/App.types";
import { usePromptsList, buildGroups } from "./usePromptsList";
import type { PromptFilters } from "./Prompts.types";
import "./Prompts.css";

export interface PromptsProps {
  navigate: Navigate;
  /** Project id to scroll to and highlight (from a sidebar deep-link). */
  target?: string;
}

const GRADES: GradeT[] = ["A", "B", "C", "D", "F"];

export function Prompts({ navigate, target }: PromptsProps) {
  const { files, projects, loading, refetch } = usePromptsList();
  const [filters, setFilters] = useState<PromptFilters>({
    tab: "all", search: "", provider: null, grade: null, sort: "grade",
  });
  const set = (patch: Partial<PromptFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const [showTemplates, setShowTemplates] = useState(false);
  const templatePicker = useTemplatePicker();

  const groups = useMemo(() => buildGroups(files, projects, filters), [files, projects, filters]);
  const flaggedCount = useMemo(() => files.filter((f) => f.issue_count > 0).length, [files]);

  // Deep-link: scroll to and briefly highlight the target project group.
  const groupRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const handledTarget = useRef<string | null>(null);

  // A new deep-link target resets the "handled" marker so its group scrolls
  // into view once its row renders; filter/search changes afterwards do not
  // re-trigger it.
  useEffect(() => {
    handledTarget.current = null;
  }, [target]);

  useEffect(() => {
    if (!target || handledTarget.current === target) return;
    const el = groupRefs.current[target];
    if (!el) return; // group not rendered yet (data still loading) — wait
    handledTarget.current = target;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setHighlighted(target);
    const t = setTimeout(() => setHighlighted(null), 1200);
    return () => clearTimeout(t);
  }, [target, groups]);

  const scanNow = async () => {
    await commands.scanNow();
    void refetch();
  };

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <h1 className="screen__title">Prompts</h1>
        <span className="toolbar-spacer" />
        {isTauri && (
          <Button size="sm" onClick={scanNow}>
            <Icon name="refresh" /> Scan now
          </Button>
        )}
        {isTauri && (
          <Button size="sm" onClick={() => setShowTemplates(true)}>
            <Icon name="plus" /> Start from a template
          </Button>
        )}
      </header>

      <div className="scroll-area">
        <div className="page" style={{ maxWidth: 1000 }}>
          {!isTauri ? (
            <Card padded><div className="muted">Open the desktop app to see your prompts.</div></Card>
          ) : loading ? (
            <Card padded><div className="muted">Loading…</div></Card>
          ) : files.length === 0 ? (
            <Card padded>
              <div className="muted" style={{ marginBottom: 14 }}>
                No prompts yet — scan a folder from the Overview tab, or start from a ready-made
                instruction file below.
              </div>
              <Button variant="primary" size="sm" onClick={() => setShowTemplates(true)}>
                <Icon name="plus" /> Start from a template
              </Button>
            </Card>
          ) : (
            <>
              <div className="p-controls">
                <div className="row" style={{ gap: 7 }}>
                  <button className={"p-chip" + (filters.tab === "all" ? " p-chip--on" : "")} onClick={() => set({ tab: "all" })}>
                    All · {files.length}
                  </button>
                  <button className={"p-chip" + (filters.tab === "flagged" ? " p-chip--on" : "")} onClick={() => set({ tab: "flagged" })}>
                    Flagged · {flaggedCount}
                  </button>
                </div>
                <span className="toolbar-spacer" />
                <select className="p-select" aria-label="Provider" value={filters.provider ?? ""} onChange={(e) => set({ provider: e.target.value || null })}>
                  <option value="">All providers</option>
                  <option value="CLAUDE.md">Claude</option>
                  <option value="AGENTS.md">Agents</option>
                  <option value=".cursorrules">Cursor</option>
                  <option value="GEMINI.md">Gemini</option>
                </select>
                <select className="p-select" aria-label="Grade" value={filters.grade ?? ""} onChange={(e) => set({ grade: (e.target.value || null) as GradeT | null })}>
                  <option value="">All grades</option>
                  {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                <select className="p-select" aria-label="Sort" value={filters.sort} onChange={(e) => set({ sort: e.target.value as PromptFilters["sort"] })}>
                  <option value="grade">Worst grade</option>
                  <option value="issues">Most issues</option>
                  <option value="recent">Recently modified</option>
                </select>
                <input className="p-search" type="search" placeholder="Search" aria-label="Search prompts"
                  value={filters.search} onChange={(e) => set({ search: e.target.value })} />
              </div>

              {groups.map(({ project, files: pf }) => (
                <div
                  key={project.id}
                  ref={(el) => { groupRefs.current[project.id] = el; }}
                  className={"p-group" + (highlighted === project.id ? " p-group--hl" : "")}
                >
                  <div className="p-group__head">
                    <ProjectGlyph name={project.name} grade={project.grade} logo={project.logo} />
                    <span className="p-group__name">{project.name}</span>
                    <Grade grade={project.grade} size="sm" />
                    <span className="toolbar-spacer" />
                    <span className="faint">
                      {project.file_count} file{project.file_count === 1 ? "" : "s"}
                      {project.issue_count > 0 && ` · ${project.issue_count} issues`}
                    </span>
                  </div>
                  <Card style={{ overflow: "hidden" }}>
                    {pf.map((f) => (
                      <button key={f.id} className="p-row" onClick={() => navigate("detail", f.id)}>
                        <ProviderIcon kind={f.kind} />
                        <span className="p-row__main">
                          <span className="p-row__name">{f.name}</span>
                          <span className="p-row__path faint">{f.path}</span>
                        </span>
                        <span className={"p-row__issues" + (f.issue_count > 0 ? " p-row__issues--bad" : "")}>
                          {f.issue_count > 0 ? `${f.issue_count} issues` : "clean"}
                        </span>
                        <Grade grade={f.grade} size="sm" />
                        <span className="faint tnum p-row__age">{relativeTime(f.modified)}</span>
                        <Icon name="chevronRight" size={15} />
                      </button>
                    ))}
                  </Card>
                </div>
              ))}

              {groups.length === 0 && <Card padded><div className="muted">No prompts match these filters.</div></Card>}
            </>
          )}
        </div>
      </div>

      {showTemplates && (
        <TemplatePicker
          templates={templatePicker.templates}
          entitled={templatePicker.entitled}
          loading={templatePicker.loading}
          onApply={templatePicker.applyTemplate}
          onClose={() => setShowTemplates(false)}
          navigate={navigate}
        />
      )}
    </section>
  );
}
