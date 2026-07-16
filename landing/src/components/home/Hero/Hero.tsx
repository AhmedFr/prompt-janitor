import { WaitlistForm } from "@/components/WaitlistForm";

export function Hero() {
  return (
    <header className="hero" id="hero">
      <div className="wrap">
        <div className="eyebrow">macOS app · runs 100% locally · launching soon</div>
        <h1 style={{ marginTop: 16 }}>
          Know in 10 seconds
          <br />
          if your prompts are good enough.
        </h1>
        <p className="lead">
          Prompt Janitor scans every <span style={{ fontFamily: "var(--mono)", fontSize: ".92em" }}>AGENTS.md</span> and{" "}
          <span style={{ fontFamily: "var(--mono)", fontSize: ".92em" }}>CLAUDE.md</span> on your Mac, grades them A–F
          against the industry's own standards, and flags what's rotting — before your agents trip on it.
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
            Founder pricing locked: $69
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
