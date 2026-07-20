import { MockWindow } from "../MockWindow";

export function DetailMock() {
  return (
    <MockWindow title="CLAUDE.md · api-worker">
      <div className="mk-pad">
        <div className="mk-code">
          <div>
            <span className="mk-ln">12</span>
            <span>## Summarization</span>
          </div>
          <div className="flag">
            <span className="mk-ln">13</span>
            <span>Use gpt-4-32k for summarization.</span>
          </div>
          <div>
            <span className="mk-ln">14</span>
            <span>Keep answers under 200 words.</span>
          </div>
        </div>
        <div className="mk-issue">
          <div className="mk-issue-head">
            <span className="sev hi" />
            <span className="mk-grow">Hard-coded model name</span>
            <span className="src person">Karpathy</span>
          </div>
          <p>Pinned model versions rot. This one no longer exists, so every agent that reads this file trips on it.</p>
          <div className="mk-fix">Suggested fix: &ldquo;Use the default model configured for this repo.&rdquo;</div>
        </div>
      </div>
    </MockWindow>
  );
}
