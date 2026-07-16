import { WaitlistForm } from "@/components/WaitlistForm";

export function FooterCta() {
  return (
    <section className="section footer-cta">
      <div className="wrap">
        <div className="ficon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="6" x2="19" y2="6" />
            <line x1="5" y1="11" x2="14" y2="11" />
            <line x1="5" y1="16" x2="9" y2="16" strokeOpacity=".5" />
            <path d="M15 15.5l1.5 1.5M16.5 15.5L15 17" strokeWidth="1.4" />
          </svg>
        </div>
        <h2>
          Grade once.
          <br />
          Stay sharp.
        </h2>
        <p>Give your prompts the visibility layer they've been missing — waitlist members launch first, at founder pricing.</p>
        <WaitlistForm source="footer" />
      </div>
    </section>
  );
}
