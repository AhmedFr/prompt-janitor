import { MockWindow } from "../MockWindow";

export function PromptsMock() {
  return (
    <MockWindow title="Prompt Janitor · Prompts">
      <div className="mk-pad">
        <div className="mk-list">
          <div className="mk-row">
            <span className="grade gA">A</span>
            <span className="mk-file">CLAUDE.md</span>
            <span className="mk-grow faint">web-app</span>
            <span className="mk-num">92</span>
          </div>
          <div className="mk-row">
            <span className="grade gB">B</span>
            <span className="mk-file">.cursorrules</span>
            <span className="mk-grow faint">web-app</span>
            <span className="mk-num">81</span>
          </div>
          <div className="mk-row">
            <span className="grade gC">C</span>
            <span className="mk-file">AGENTS.md</span>
            <span className="mk-grow faint">ml-pipeline</span>
            <span className="mk-num">74</span>
          </div>
          <div className="mk-row">
            <span className="grade gD">D</span>
            <span className="mk-file">CLAUDE.md</span>
            <span className="mk-grow faint">api-worker</span>
            <span className="mk-num">58</span>
          </div>
          <div className="mk-row">
            <span className="grade gF">F</span>
            <span className="mk-file">.cursorrules</span>
            <span className="mk-grow faint">legacy-crm</span>
            <span className="mk-num">41</span>
          </div>
        </div>
      </div>
    </MockWindow>
  );
}
