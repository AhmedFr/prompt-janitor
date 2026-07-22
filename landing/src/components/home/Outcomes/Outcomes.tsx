import { DitherGradient } from "@/components/dither-kit/gradient";
import { Sparkline } from "@/components/dither-kit/sparkline";

export function Outcomes() {
  return (
    <section className="section" id="outcomes">
      <div className="wrap">
        <div className="section-head">
          <h2>Rotting prompts are a tax you pay on every run</h2>
          <p>
            Every defect charges you again on every task, in every repo &mdash; in tokens, in extra turns, in your own
            review time. Here&rsquo;s the bill.
          </p>
        </div>
        <div className="oc-grid">
          <div className="oc-card oc-lead">
            <DitherGradient from="blue" direction="left" cell={3} opacity={0.16} className="oc-wash" aria-hidden="true" />
            <div className="oc-body">
              <div className="oc-kicker">The defect tax</div>
              <div className="oc-stat">+36.8k tokens</div>
              <h3>One missing example = +36.8k tokens. Per task.</h3>
              <p>
                In our first controlled runs, one missing example cost an average of 36,759 extra tokens per task. Same task,
                same agent, one defect apart. Every prompt defect is a recurring bill: it charges you again on every run, in
                every repo. Finding and fixing defects is the cheapest optimization you haven&rsquo;t done &mdash; and it&rsquo;s
                exactly what the scan hands you.
              </p>
              <Sparkline data={[9, 11, 10, 14, 19, 26, 36.8]} color="blue" variant="gradient" animate={false} className="oc-spark" aria-hidden="true" />
            </div>
          </div>
          <div className="oc-card">
            <div className="oc-kicker">Human involvement</div>
            <h3>Stop babysitting the output</h3>
            <p>
              In the same runs, the fixed prompt left 0.4 fewer major issues per task for a human to clean up. The point of an
              agent is that you review once, not line by line.
            </p>
          </div>
          <div className="oc-card">
            <div className="oc-kicker">Fewer round-trips</div>
            <h3>Stop watching agents wander</h3>
            <p>
              Ambiguous context makes agents wander: 0.8 extra turns per task with the defective prompt. Clear roles, examples,
              and output contracts get to done sooner.
            </p>
          </div>
          <div className="oc-card">
            <div className="oc-kicker">Trends &amp; analytics</div>
            <h3>Watch the waste shrink</h3>
            <p>
              Health history and per-project trends ship in the app. Next up: an impact view that translates every fixed defect
              into tokens and turns saved.
            </p>
            <span className="oc-flag">Impact view on the roadmap</span>
          </div>
          <div className="oc-card">
            <div className="oc-kicker">Chat analysis</div>
            <h3>Learn from your real sessions</h3>
            <p>
              Mining your actual agent transcripts to show where a prompt file cost you money, and what changed after the fix.
              Grounded in your usage, not our lab.
            </p>
            <span className="oc-flag">On the roadmap</span>
          </div>
        </div>
        <p className="oc-note">
          Benchmark figures come from our first N=5 controlled runs and are not yet statistically significant.{" "}
          <a href="/blog/what-a-bad-prompt-actually-costs">Read the methodology</a>.
        </p>
      </div>
    </section>
  );
}
