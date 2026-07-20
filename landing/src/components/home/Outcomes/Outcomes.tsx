export function Outcomes() {
  return (
    <section className="section" id="outcomes">
      <div className="wrap">
        <div className="section-head">
          <h2>What a clean prompt file gives you back</h2>
          <p>Prompt health isn't cosmetic. Every defect taxes tokens, turns, and your own time, on every single run.</p>
        </div>
        <div className="oc-grid">
          <div className="oc-card oc-lead">
            <div className="oc-kicker">Token economy</div>
            <div className="oc-stat">+36.8k tokens</div>
            <h3>Stop paying the defect tax</h3>
            <p>
              In our first controlled runs, one missing example cost an average of 36,759 extra tokens per task. Same task, same
              agent, one defect apart. Every prompt defect is a recurring bill: it charges you again on every run, in every repo.
              Finding and fixing them is the cheapest optimization you haven't done.
            </p>
          </div>
          <div className="oc-card">
            <div className="oc-kicker">Human involvement</div>
            <h3>Less babysitting after the run</h3>
            <p>
              In the same runs, the fixed prompt left 0.4 fewer major issues per task for a human to clean up. The point of an
              agent is that you review once, not line by line.
            </p>
          </div>
          <div className="oc-card">
            <div className="oc-kicker">Fewer round-trips</div>
            <h3>Agents converge faster</h3>
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
