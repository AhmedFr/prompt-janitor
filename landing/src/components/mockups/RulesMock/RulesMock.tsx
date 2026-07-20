import { MockWindow } from "../MockWindow";

export function RulesMock() {
  return (
    <MockWindow title="Prompt Janitor · Rules">
      <div className="mk-pad">
        <div className="mk-list">
          <div className="mk-row">
            <span className="sev hi" />
            <span className="mk-grow">No hard-coded model names</span>
            <span className="src person">Karpathy</span>
          </div>
          <div className="mk-row">
            <span className="sev mid" />
            <span className="mk-grow">Must define a clear role</span>
            <span className="src anthropic">Anthropic</span>
          </div>
          <div className="mk-row">
            <span className="sev mid" />
            <span className="mk-grow">Always mention the deploy command</span>
            <span className="src custom">Custom</span>
          </div>
        </div>
        <div className="mk-composer">
          <span className="mk-input">Never promise a delivery date&hellip;</span>
          <span className="mk-addbtn">Add rule</span>
        </div>
      </div>
    </MockWindow>
  );
}
