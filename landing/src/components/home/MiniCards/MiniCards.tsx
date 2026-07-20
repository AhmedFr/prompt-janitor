export function MiniCards() {
  return (
    <section className="section">
      <div className="wrap">
        <div className="cards2">
          <div className="card">
            <h4>Custom rules, plain English</h4>
            <p>House rules live right alongside the built-ins: type the intent, pick a severity, done.</p>
            <div className="minirow">
              <span className="sev hi"></span>
              <span className="grow">No hard-coded model names</span>
              <span className="src person">Karpathy</span>
            </div>
            <div className="minirow">
              <span className="sev mid"></span>
              <span className="grow">Always mention the deploy command</span>
              <span className="src custom">Custom</span>
            </div>
            <div className="minirow">
              <span className="sev mid"></span>
              <span className="grow">Must define a clear role</span>
              <span className="src anthropic">Anthropic</span>
            </div>
          </div>
          <div className="card">
            <h4>Grouped by project &amp; source</h4>
            <p>Filter your whole prompt estate by repo, file type, or which guidebook flagged the issue.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "9px", marginBottom: "16px" }}>
              <span className="src anthropic">Anthropic</span>
              <span className="src openai">OpenAI</span>
              <span className="src person">Karpathy</span>
              <span className="src custom">Custom</span>
            </div>
            <div className="minirow">
              <span className="grade gA">A</span>
              <span className="grow">web-app</span>
              <span className="faint">6 files</span>
            </div>
            <div className="minirow">
              <span className="grade gD">D</span>
              <span className="grow">api-worker</span>
              <span className="faint">2 critical</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
