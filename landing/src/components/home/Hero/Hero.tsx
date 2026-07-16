export function Hero() {
  return (
    <header className="hero" id="hero">
      <div className="wrap">
        <div className="eyebrow">macOS app · runs 100% locally</div>
        <h1 style={{ marginTop: 16 }}>
          Your prompts,
          <br />
          finally under inspection.
        </h1>
        <p className="lead">
          Prompt Janitor scans every <span style={{ fontFamily: "var(--mono)", fontSize: ".92em" }}>AGENTS.md</span> and{" "}
          <span style={{ fontFamily: "var(--mono)", fontSize: ".92em" }}>CLAUDE.md</span> on your Mac, grades them A–F against the best
          standards, and flags what's rotting — before your agents trip on it.
        </p>
        <div className="cta">
          <a className="btn" href="/#pricing">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 4v11" />
              <path d="M7 11l5 5 5-5" />
              <path d="M5 20h14" />
            </svg>{" "}
            Download for macOS
          </a>
          <a className="btn ghost" href="/#features">
            See how it works
          </a>
        </div>
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
            30-day grade-up guarantee
          </span>
        </div>
        <div className="hero-shot">
          <div className="shot-frame">
            <img src="/shots/dashboard.png" alt="Prompt Janitor overview with health grades" />
          </div>
        </div>
      </div>
    </header>
  );
}
