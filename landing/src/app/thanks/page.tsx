import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import "./thanks.css";

export const metadata: Metadata = {
  title: "You're in · Prompt Janitor",
  description: "Thanks for grabbing Prompt Janitor Pro. Your license key is on its way. Here's how to activate it.",
  robots: { index: false },
};

export default function Thanks() {
  return (
    <>
      <Nav />
      <main id="main">
        <section className="thanks-hero">
          <div className="wrap">
            <div className="thanks-check" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="5 12.5 10 17.5 19 7" />
              </svg>
            </div>
            <h1>You're in.</h1>
            <p className="lead">Your license key is on its way to your inbox, sent within a minute of purchase.</p>

            <div className="steps">
              <div className="step">
                <span className="n" aria-hidden="true">
                  1
                </span>
                <p>
                  Open the email from Polar / Prompt Janitor and copy your <code>PJ1.</code> key.
                </p>
              </div>
              <div className="step">
                <span className="n" aria-hidden="true">
                  2
                </span>
                <p>
                  In the app: <b>Settings → License</b>, paste the key, and hit <b>Activate</b>. Verified offline, no account needed.
                </p>
              </div>
              <div className="step">
                <span className="n" aria-hidden="true">
                  3
                </span>
                <p>
                  Hit <b>Auto-fix</b> on your worst file and watch the grade move.
                </p>
              </div>
            </div>

            <p className="thanks-note">
              Didn't get it? Check spam, or reach out and we'll sort it: <a href="mailto:support@promptjanitor.app">support@promptjanitor.app</a>.
            </p>
            <p className="thanks-note">
              And remember: <b>30-day letter-grade guarantee.</b> If your prompt-file health doesn't go up a full letter grade within 30
              days, full refund.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
