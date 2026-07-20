import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/home/Hero";
import { Outcomes } from "@/components/home/Outcomes";
import { EvidenceStrip } from "@/components/home/EvidenceStrip";
import { TagStrip } from "@/components/home/TagStrip";
import { FeatureRows } from "@/components/home/FeatureRows";
import { HowItWorks } from "@/components/home/HowItWorks";
import { MiniCards } from "@/components/home/MiniCards";
import { Audience } from "@/components/home/Audience";
import { Philosophy } from "@/components/home/Philosophy";
import { Pricing } from "@/components/home/Pricing";
import { Faq } from "@/components/home/Faq";
import { FooterCta } from "@/components/home/FooterCta";

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <Outcomes />
        <EvidenceStrip />
        <TagStrip />
        <FeatureRows />
        <HowItWorks />
        <MiniCards />
        <Audience />
        <Philosophy />
        <Pricing />
        <Faq />
        <FooterCta />
      </main>
      <Footer />
    </>
  );
}
