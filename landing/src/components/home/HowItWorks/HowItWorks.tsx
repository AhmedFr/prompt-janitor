export function HowItWorks() {
  return (
    <section className="section" id="how">
      <div className="wrap">
        <div className="section-head">
          <h2>Scan. Grade. Treat.</h2>
          <p>Diagnosis is free forever. Treatment is what you pay for.</p>
        </div>
        <div className="how">
          <div className="how-step">
            <span className="n" aria-hidden="true">1</span>
            <h4>Scan</h4>
            <p>
              Point it at your projects. It finds every prompt file (<code>CLAUDE.md</code>, <code>AGENTS.md</code>,{" "}
              <code>.cursorrules</code>) and rescans on a schedule.
            </p>
          </div>
          <div className="how-step">
            <span className="n" aria-hidden="true">2</span>
            <h4>Grade</h4>
            <p>
              Each file gets an A–F health grade against source-cited standards from Anthropic, OpenAI, and the
              practitioners who wrote the playbook.
            </p>
          </div>
          <div className="how-step">
            <span className="n" aria-hidden="true">3</span>
            <h4>Treat</h4>
            <p>
              Pro rewrites the weak parts with AI: apply with a backup, one-click undo, and an optional git branch so
              changes stay reviewable.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
