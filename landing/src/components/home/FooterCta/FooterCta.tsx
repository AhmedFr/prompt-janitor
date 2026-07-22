import { BrushCleaningIcon } from "@/components/BrushCleaningIcon";
import { WaitlistForm } from "@/components/WaitlistForm";
import { DitherGradient } from "@/components/dither-kit/gradient";

export function FooterCta() {
  return (
    <section className="section footer-cta">
      <DitherGradient from="blue" direction="up" cell={4} opacity={0.25} className="fcta-wash" aria-hidden="true" />
      <div className="wrap">
        <div className="ficon" aria-hidden="true">
          <BrushCleaningIcon />
        </div>
        <h2>Stop blaming the model.</h2>
        <p>Fix the files it reads. Waitlist members launch first, at early-bird pricing.</p>
        <WaitlistForm source="footer" />
      </div>
    </section>
  );
}
