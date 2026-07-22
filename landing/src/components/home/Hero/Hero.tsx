import { WaitlistForm } from "@/components/WaitlistForm";
import { OverviewMock } from "@/components/mockups/OverviewMock";
import { DitherGradient } from "@/components/dither-kit/gradient";

export function Hero() {
  return (
    <header className="hero" id="hero">
      <DitherGradient from="blue" direction="down" cell={3} opacity={0.3} className="hero-wash" aria-hidden="true" />
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <div className="htags" aria-label="macOS app, runs 100 percent locally, launching soon">
            <span className="htag">[macOS]</span>
            <span className="htag">[100% LOCAL]</span>
            <span className="htag">[LAUNCHING SOON]</span>
          </div>
          <h1>Flaky agents aren&rsquo;t a model problem. They&rsquo;re a prompt problem.</h1>
          <p className="lead">
            The <span className="mono-inline">CLAUDE.md</span> you wrote six weeks ago is sabotaging today&rsquo;s runs.
            Prompt Janitor hunts down every rotting prompt file on your Mac, grades it A&ndash;F, and hands you the fix
            &mdash; dependable agents, fewer retries, fewer tokens.
          </p>
          <WaitlistForm source="hero" />
          <div className="trust">
            <span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="5 12.5 10 17.5 19 7" />
              </svg>{" "}
              Diagnosis free forever
            </span>
            <span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="5 12.5 10 17.5 19 7" />
              </svg>{" "}
              Runs fully offline
            </span>
            <span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="5 12.5 10 17.5 19 7" />
              </svg>{" "}
              macOS Sonoma 14+
            </span>
            <span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="5 12.5 10 17.5 19 7" />
              </svg>{" "}
              Early-bird pricing locked: $19
            </span>
          </div>
        </div>
        <div className="hero-art">
          <div className="hero-frame">
            <OverviewMock />
          </div>
        </div>
      </div>
    </header>
  );
}
