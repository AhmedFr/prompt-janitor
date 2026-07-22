import { Sparkline } from "@/components/dither-kit/sparkline";

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
            <Sparkline data={[8, 10, 9, 13, 18, 25, 36]} color="red" variant="gradient" animate={false} className="ev-spark" aria-hidden="true" />
          </div>
          <div className="ev-stat">
            <div className="n">+0.8</div>
            <div className="l">
              extra agent turns
              <br />
              to finish the same task
            </div>
            <Sparkline data={[1.2, 1.5, 1.4, 1.8, 2.0]} color="orange" variant="gradient" animate={false} className="ev-spark" aria-hidden="true" />
          </div>
          <div className="ev-stat">
            <div className="n">−0.4</div>
            <div className="l">
              major review issues
              <br />
              after the prompt was fixed
            </div>
            <Sparkline data={[2.2, 2.0, 1.6, 1.1, 0.8]} color="green" variant="gradient" animate={false} className="ev-spark" aria-hidden="true" />
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
