import { BrushCleaningIcon } from "@/components/BrushCleaningIcon";
import { MockWindow } from "../MockWindow";

export function OverviewMock() {
  return (
    <MockWindow title="Prompt Janitor · Overview">
      <div className="mk-body">
        <aside className="mk-side">
          <div className="mk-side-brand">
            <BrushCleaningIcon /> Prompt Janitor
          </div>
          <span className="mk-item on">Overview</span>
          <span className="mk-item">Prompts</span>
          <span className="mk-item">Scans</span>
          <span className="mk-item">Rules</span>
          <span className="mk-item">Settings</span>
        </aside>
        <div className="mk-content">
          <div className="mk-ovhead">
            <div className="mk-ring">
              <span>B</span>
            </div>
            <div>
              <div className="mk-score">
                78<span>/100</span>
              </div>
              <div className="mk-bar">
                <i style={{ width: "78%" }} />
              </div>
              <div className="mk-pills">
                <span className="mk-pill hi">3 critical</span>
                <span className="mk-pill mid">7 warnings</span>
                <span className="mk-pill lo">5 nits</span>
              </div>
            </div>
          </div>
          <div className="mk-list">
            <div className="mk-row">
              <span className="sev hi" />
              <span className="mk-grow">Hard-coded model name</span>
              <span className="src person">Karpathy</span>
            </div>
            <div className="mk-row">
              <span className="sev hi" />
              <span className="mk-grow">Contradictory instructions</span>
              <span className="src anthropic">Anthropic</span>
            </div>
            <div className="mk-row">
              <span className="sev mid" />
              <span className="mk-grow">No role or persona set</span>
              <span className="src anthropic">Anthropic</span>
            </div>
            <div className="mk-row">
              <span className="sev mid" />
              <span className="mk-grow">Output format unspecified</span>
              <span className="src openai">OpenAI</span>
            </div>
            <div className="mk-row">
              <span className="sev mid" />
              <span className="mk-grow">Missing worked example</span>
              <span className="src anthropic">Anthropic</span>
            </div>
          </div>
        </div>
      </div>
    </MockWindow>
  );
}
