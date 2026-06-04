import { useState } from "react";
import { Grade } from "@/components/Grade";
import { Icon } from "@/components/Icon";
import { Card } from "@/components/Card";
import { isTauri } from "@/lib/ipc";
import { relativeTime } from "@/lib/format";
import type { Navigate } from "@/App/App.types";
import { useFiles } from "./useFiles";
import "./Prompts.css";

type Filter = "all" | "flagged" | "CLAUDE.md" | "AGENTS.md" | ".cursorrules";

export interface PromptsProps {
  navigate: Navigate;
}

export function Prompts({ navigate }: PromptsProps) {
  const { files, loading } = useFiles();
  const [filter, setFilter] = useState<Filter>("all");

  const shown = files.filter((f) => {
    if (filter === "all") return true;
    if (filter === "flagged") return f.issue_count > 0;
    return f.name === filter;
  });

  const flaggedCount = files.filter((f) => f.issue_count > 0).length;
  const chips: [Filter, string][] = [
    ["all", `All · ${files.length}`],
    ["flagged", `Flagged · ${flaggedCount}`],
    ["CLAUDE.md", "CLAUDE.md"],
    ["AGENTS.md", "AGENTS.md"],
    [".cursorrules", ".cursorrules"],
  ];

  return (
    <section className="screen">
      <header className="screen__toolbar" data-tauri-drag-region>
        <h1 className="screen__title">Prompts</h1>
      </header>

      <div className="scroll-area">
        <div className="page" style={{ maxWidth: 1000 }}>
          {!isTauri ? (
            <Card padded>
              <div className="muted">Open the desktop app to see your prompts.</div>
            </Card>
          ) : loading ? (
            <Card padded>
              <div className="muted">Loading…</div>
            </Card>
          ) : files.length === 0 ? (
            <Card padded>
              <div className="muted">No prompts yet — scan a folder from the Overview tab.</div>
            </Card>
          ) : (
            <>
              <div className="row wrap" style={{ gap: 7, marginBottom: 14 }}>
                {chips.map(([key, label]) => (
                  <button
                    key={key}
                    className={"p-chip" + (filter === key ? " p-chip--on" : "")}
                    onClick={() => setFilter(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <Card style={{ overflow: "hidden" }}>
                <table className="p-tbl">
                  <thead>
                    <tr>
                      <th>File</th>
                      <th>Project</th>
                      <th>Grade</th>
                      <th>Issues</th>
                      <th>Modified</th>
                      <th aria-hidden />
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((f) => (
                      <tr key={f.id} onClick={() => navigate("detail", f.id)}>
                        <td>
                          <span className="row" style={{ gap: 8 }}>
                            <span className="p-file-ico">
                              <Icon name="prompts" size={15} />
                            </span>
                            <span style={{ fontWeight: 500 }}>{f.name}</span>
                          </span>
                        </td>
                        <td className="muted">{f.project}</td>
                        <td>
                          <Grade grade={f.grade} size="sm" />
                        </td>
                        <td className="tnum">{f.issue_count || "—"}</td>
                        <td className="faint tnum">{relativeTime(f.modified)}</td>
                        <td className="p-chev">
                          <Icon name="chevronRight" size={15} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>

              <div className="row between faint" style={{ fontSize: 12, marginTop: 12 }}>
                <span>
                  Showing {shown.length} of {files.length}
                </span>
                <span>Grouped by grade</span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
