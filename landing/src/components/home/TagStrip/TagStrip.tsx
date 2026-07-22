export function TagStrip() {
  return (
    <section className="section">
      <div className="wrap">
        <div className="section-head">
          <h2>Right now, you&rsquo;re flying blind.</h2>
          <p>
            No linter, no review, no grade for the files your agents read on every single run. Prompt Janitor is the
            missing instrument panel.
          </p>
        </div>
        <div className="tags">
          <span className="tag">
            <b>Auto-scan</b> every 6h
          </span>
          <span className="tag">
            <b>A–F</b> grades
          </span>
          <span className="tag">Best-practice rules</span>
          <span className="tag">Source-cited issues</span>
          <span className="tag">
            <b>Local-first</b>
          </span>
          <span className="tag">Custom rules</span>
          <span className="tag">Regression alerts</span>
          <span className="tag">Weekly digest</span>
        </div>
      </div>
    </section>
  );
}
