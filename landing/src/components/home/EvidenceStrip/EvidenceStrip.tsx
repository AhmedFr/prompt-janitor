export function EvidenceStrip() {
  return (
    <section className="section tint evidence" id="evidence">
      <div className="wrap">
        <div className="section-head">
          <div className="eyebrow">Evidence, not vibes</div>
          <h2 style={{ marginTop: 12 }}>We measure what bad prompts actually cost.</h2>
          <p>
            We run controlled benchmarks: the same coding task, the same agent, one prompt defect apart. Then we count
            the damage.
          </p>
        </div>
        <div className="ev-stats">
          <div className="ev-stat">
            <div className="n">+36k</div>
            <div className="l">
              tokens burned per task
              <br />
              with one defective prompt
            </div>
          </div>
          <div className="ev-stat">
            <div className="n">+0.8</div>
            <div className="l">
              extra agent turns
              <br />
              to finish the same task
            </div>
          </div>
          <div className="ev-stat">
            <div className="n">−0.4</div>
            <div className="l">
              major review issues
              <br />
              after the prompt was fixed
            </div>
          </div>
        </div>
        <p className="ev-caveat">
          Early numbers from our first controlled runs (N=5), not yet statistically significant, and we say so. The
          full powered benchmark runs next, and we're publishing everything, methodology included.
        </p>
        <a className="ev-link" href="/blog/what-a-bad-prompt-actually-costs">
          Read the methodology →
        </a>
      </div>
    </section>
  );
}
