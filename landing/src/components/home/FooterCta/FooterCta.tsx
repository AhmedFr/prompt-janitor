import { BrushCleaningIcon } from "@/components/BrushCleaningIcon";
import { WaitlistForm } from "@/components/WaitlistForm";

export function FooterCta() {
  return (
    <section className="section footer-cta">
      <div className="wrap">
        <div className="ficon" aria-hidden="true">
          <BrushCleaningIcon />
        </div>
        <h2>
          Grade once.
          <br />
          Stay sharp.
        </h2>
        <p>Give your prompts the visibility layer they've been missing. Waitlist members launch first, at early-bird pricing.</p>
        <WaitlistForm source="footer" />
      </div>
    </section>
  );
}
