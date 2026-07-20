import { WaitlistForm } from "@/components/WaitlistForm";

export function Pricing() {
  return (
    <section className="section" id="pricing">
      <div className="wrap">
        <div className="section-head">
          <h2>Diagnosis free. Treatment paid.</h2>
          <p>
            We grade your prompt files against the industry's own standards — free, unlimited, on your machine, with your compute.
            Grading against YOUR standards, and fixing anything — that's Pro.
          </p>
        </div>
        <div className="price-grid">
          <div className="price-card">
            <div className="price-top">
              <div className="plan-name">Free — Diagnosis</div>
              <div className="price-amount">
                <span className="now">$0</span>
              </div>
              <div className="badge-offer free">Free forever · no scan caps</div>
            </div>
            <div className="price-body">
              <ul className="plist">
                <li>
                  <span className="ck" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="5 12.5 10 17.5 19 7" />
                    </svg>
                  </span>{" "}
                  <span>Unlimited scanning — scheduling, watch mode, notifications, history &amp; trends. No scan caps, ever</span>
                </li>
                <li>
                  <span className="ck" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="5 12.5 10 17.5 19 7" />
                    </svg>
                  </span>{" "}
                  <span>All deterministic fact rules, with source-cited findings — never hidden or blurred</span>
                </li>
                <li>
                  <span className="ck" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="5 12.5 10 17.5 19 7" />
                    </svg>
                  </span>{" "}
                  <span>
                    Built-in <b>25-standard AI catalog</b> evaluation — free when you bring compute (local Ollama or your own API key)
                  </span>
                </li>
                <li>
                  <span className="ck" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="5 12.5 10 17.5 19 7" />
                    </svg>
                  </span>{" "}
                  <span>Standards updates keep flowing to free users</span>
                </li>
              </ul>
              <WaitlistForm source="pricing-free" compact buttonLabel="Join the waitlist" />
              <p className="price-note">Launching soon — the waitlist gets the download first. No payment, no account.</p>
            </div>
          </div>

          <div className="price-card pro">
            <div className="price-top">
              <div className="plan-name">Pro — Treatment</div>
              <div className="price-amount">
                <span className="now">$19</span>
                <span className="was">$30</span>
              </div>
              <div className="badge-offer">Early-bird pricing · one-time</div>
            </div>
            <div className="price-body">
              <p className="plist-intro">Everything in Free, plus:</p>
              <ul className="plist">
                <li>
                  <span className="ck" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="5 12.5 10 17.5 19 7" />
                    </svg>
                  </span>{" "}
                  <span>
                    AI rewrites + <b>Apply fix / Auto-fix</b> — backup, undo, optional git branch
                  </span>
                </li>
                <li>
                  <span className="ck" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="5 12.5 10 17.5 19 7" />
                    </svg>
                  </span>{" "}
                  <span>Custom rules in plain English — your standards, enforced on every scan</span>
                </li>
                <li>
                  <span className="ck" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="5 12.5 10 17.5 19 7" />
                    </svg>
                  </span>{" "}
                  <span>
                    Starter template packs — A-grade <span style={{ fontFamily: "var(--mono)", fontSize: ".9em" }}>CLAUDE.md</span>,{" "}
                    <span style={{ fontFamily: "var(--mono)", fontSize: ".9em" }}>AGENTS.md</span> &amp;{" "}
                    <span style={{ fontFamily: "var(--mono)", fontSize: ".9em" }}>.cursorrules</span> per stack
                  </span>
                </li>
                <li>
                  <span className="ck" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="5 12.5 10 17.5 19 7" />
                    </svg>
                  </span>{" "}
                  <span>
                    Bonus: <b>Prompt-File Field Guide (PDF)</b> — the 25 standards, explained
                  </span>
                </li>
                <li>
                  <span className="ck" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="5 12.5 10 17.5 19 7" />
                    </svg>
                  </span>{" "}
                  <span>12 months of feature updates</span>
                </li>
              </ul>
              <WaitlistForm source="pricing-pro" compact buttonLabel="Join and lock in $19" />
              <p className="price-note">
                $19 is the launch sale price; it goes to $30 afterwards. Waitlist members lock in the sale price.
                <br />
                This pricing isn't definitive and may still change before launch.
                <br />
                One-time purchase: perpetual license + 12 months of updates · $29/yr optional renewal, never required.
              </p>
            </div>
          </div>
        </div>
        <div className="guarantee">
          <span className="g-ico" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6z" />
              <polyline points="8.5 12.5 11 15 15.5 9.5" />
            </svg>
          </span>
          <div>
            <b>30-day grade-up guarantee.</b> If your prompt-file health doesn't go up a full letter grade within 30 days, full refund.
          </div>
        </div>
      </div>
    </section>
  );
}
